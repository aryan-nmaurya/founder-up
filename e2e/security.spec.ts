import { expect, test } from "@playwright/test";
import {
  PRIVATE_PROFILE_COLUMNS,
  PUBLIC_PROFILE_COLUMNS,
} from "../src/lib/profile-columns";
import {
  admin,
  anonClient,
  createFounder,
  createUser,
  uniqueName,
  userClient,
} from "./support/supabase";
import { foundersIssued } from "./support/db";

// These go straight at PostgREST with the public anon key or a founder's own
// session - exactly what anyone can do from a browser console, bypassing the
// app entirely. Launch review blockers 4, 5 and 6.

test.describe("private profile data (blocker 4)", () => {
  test("anyone can read the public columns, and only those", async () => {
    const founder = await createFounder();
    const anon = anonClient();

    const { data, error } = await anon
      .from("profiles")
      .select(PUBLIC_PROFILE_COLUMNS)
      .eq("id", founder.founderId)
      .single();
    expect(error).toBeNull();
    expect(data).toMatchObject({ username: founder.username });

    for (const column of PRIVATE_PROFILE_COLUMNS) {
      const { error } = await anon.from("profiles").select(column).limit(1);
      expect(error?.message, column).toMatch(/permission denied/);
    }
    const { error: everything } = await anon.from("profiles").select("*").limit(1);
    expect(everything?.message).toMatch(/permission denied/);
  });

  test("a founder reads their own private row, and no one else's", async () => {
    const ada = await createFounder();
    const bo = await createFounder();

    const { error } = await ada.client
      .from("profiles")
      .select("auth_user_id, is_admin")
      .eq("id", bo.founderId);
    expect(error?.message).toMatch(/permission denied/);

    const { data: own, error: ownError } = await ada.client.rpc("current_profile").single();
    expect(ownError).toBeNull();
    expect(own).toMatchObject({ id: ada.founderId, auth_user_id: ada.id, is_admin: false });
  });

  test("a founder cannot write their own score, rank or admin flag", async () => {
    const ada = await createFounder();
    for (const change of [
      { total_rank_points: 1_000_000 },
      { is_ranked: true },
      { is_admin: true },
      { country_code: "GB" },
    ]) {
      const { error } = await ada.client.from("profiles").update(change).eq("id", ada.founderId);
      expect(error?.message, JSON.stringify(change)).toMatch(/permission denied/);
    }
  });
});

test.describe("reach statistics (blocker 5)", () => {
  test("are only ever the caller's own", async () => {
    const ada = await createFounder();
    const bo = await createFounder();
    await admin.rpc("record_profile_view", { p_founder_id: ada.founderId, p_visitor_hash: "v1" });
    await admin.rpc("record_click", {
      p_founder_id: ada.founderId,
      p_link_type: "WEBSITE",
      p_venture_id: null,
    });

    const { error: anonError } = await anonClient().rpc("my_founder_stats");
    expect(anonError?.message).toMatch(/permission denied/);

    // The old per-founder function is gone entirely.
    const { error: oldError } = await anonClient().rpc("founder_stats", {
      p_founder_id: ada.founderId,
    });
    expect(oldError?.code).toBe("PGRST202");

    const { data: adaStats } = await ada.client.rpc("my_founder_stats").single();
    expect(adaStats).toMatchObject({ profile_views: 1, website_clicks: 1, connect_clicks: 0 });
    const { data: boStats } = await bo.client.rpc("my_founder_stats").single();
    expect(boStats).toMatchObject({ profile_views: 0, website_clicks: 0, connect_clicks: 0 });
  });
});

test.describe("validation the app used to be the only line of (blocker 6)", () => {
  test("profile links must be http(s)", async () => {
    const ada = await createFounder();
    const hostile: Record<string, string> = {
      website_url: "javascript:alert(document.cookie)",
      avatar_url: "data:image/svg+xml,<svg onload=alert(1)>",
      x_url: "vbscript:msgbox(1)",
      linkedin_url: "https://localhost/in/ada",
      github_url: "ftp://github.com/ada",
    };
    for (const [column, value] of Object.entries(hostile)) {
      const { error } = await ada.client
        .from("profiles")
        .update({ [column]: value })
        .eq("id", ada.founderId);
      expect(error?.message, column).toMatch(/violates check constraint/);
    }

    const { error } = await ada.client
      .from("profiles")
      .update({ website_url: "https://ada.dev/" })
      .eq("id", ada.founderId);
    expect(error).toBeNull();
  });

  test("the Connect email must be an email", async () => {
    const ada = await createFounder();
    const { error } = await ada.client
      .from("profiles")
      .update({ contact_type: "EMAIL", contact_value: "not-an-email" })
      .eq("id", ada.founderId);
    expect(error?.message).toMatch(/profiles_contact_value_valid/);
  });

  test("venture links must be http(s)", async () => {
    const ada = await createFounder();
    const insert = (fields: Record<string, string>) =>
      ada.client
        .from("ventures")
        .insert({ founder_id: ada.founderId, type: "PROJECT", name: "Link test", ...fields });

    expect((await insert({ url: "javascript:alert(1)" })).error?.message).toMatch(
      /ventures_url_http/,
    );
    expect((await insert({ logo_url: "data:image/png;base64,AAAA" })).error?.message).toMatch(
      /ventures_logo_url_http/,
    );
    expect((await insert({ url: "https://good.dev/" })).error).toBeNull();
  });

  test("countries come from the real list, and the cooldown can't be skipped", async () => {
    const ada = await createFounder({ country: "IN" });

    const { error: fake } = await ada.client.rpc("change_country", { p_country_code: "ZZ" });
    expect(fake?.message).toMatch(/COUNTRY_INVALID/);

    // The old signature took the cooldown from the caller. It no longer exists.
    const { error: bypass } = await ada.client.rpc("change_country", {
      p_country_code: "GB",
      p_cooldown_days: 0,
    });
    expect(bypass?.code).toBe("PGRST202");

    expect((await ada.client.rpc("change_country", { p_country_code: "GB" })).error).toBeNull();
    const { error: again } = await ada.client.rpc("change_country", { p_country_code: "FR" });
    expect(again?.message).toMatch(/COUNTRY_COOLDOWN/);
  });

  test("a rejected onboarding call never burns an Early Founder number", async () => {
    const client = await userClient(await createUser());
    const before = await foundersIssued();

    for (const [args, reason] of [
      [{ p_full_name: "Zed", p_country_code: "ZZ", p_headline: null }, /COUNTRY_INVALID/],
      [{ p_full_name: "x".repeat(61), p_country_code: "IN", p_headline: null }, /NAME_INVALID/],
      [{ p_full_name: "Zed", p_country_code: "IN", p_headline: "x".repeat(81) }, /HEADLINE_INVALID/],
    ] as const) {
      const { error } = await client.rpc("create_founder_profile", {
        p_username: uniqueName("zed"),
        ...args,
      });
      expect(error?.message).toMatch(reason);
    }

    expect(await foundersIssued()).toBe(before);
  });
});
