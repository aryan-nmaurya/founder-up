# FounderUp

## Product concept

**FounderRank is a public paid leaderboard and discovery network for founders.**

A founder creates a public profile, shows what they have built or what business they currently run, links their website/social profiles, and appears on the leaderboard.

Founders can pay to increase their own Rank Score.

Visitors can browse founders globally or by country, open their profiles, see what they are working on, and connect with them directly.

The product should be intentionally simple.

**Core loop:**

Founder joins → completes profile → appears on leaderboard → boosts rank → becomes more visible → shares rank → visitors discover founder → visitors explore projects/business → visitors connect → other founders discover FounderRank → repeat.

---

# 1. Final product rules

These rules should be decided before writing the app.

### Who can rank?

Only individual founders.

No:

* Project-only accounts
* Company-only accounts
* Agencies as leaderboard entities
* Student leaderboard
* Developer leaderboard
* Categories

A founder may list multiple projects/businesses underneath their profile.

---

## Rankings

There are only two geographic scopes:

**Global**

and

**Country**

For example:

> 🌍 #41 Global
> 🇮🇳 #6 India

Country ranking is determined from the founder's selected country.

No:

* City ranking
* State ranking
* Industry/category ranking

---

# 2. Leaderboard periods

I recommend copying one particularly good part of the Outbid model:

**All-Time**

and

**Today**

Outbid currently exposes both All-time and Today rankings, keeping the interface simple while giving new entrants a leaderboard they can realistically compete in.

FounderRank should therefore have:

`All-Time | Today`

combined with:

`Global | Country`

This creates only four views:

* Global / All-Time
* Global / Today
* Country / All-Time
* Country / Today

No weekly/monthly tabs initially.

### Why Today matters

Eventually the All-Time #1 founder could have an enormous score.

A new user might have no realistic chance of catching them.

But they can still compete for:

> #1 Founder Today

This keeps the competition alive without requiring complicated seasons.

Define **Today using UTC**, not each visitor's timezone, so everyone sees the same leaderboard.

Display:

> Daily leaderboard resets at 00:00 UTC.

---

# 3. Money and Rank Score

Do not directly rank:

> $ amount

against:

> ₹ amount

Instead use one internal metric:

## Rank Points

Recommended rule:

> **₹1 of INR-equivalent captured value = 1 Rank Point**

Examples:

₹100 successful payment:

> +100 RP

₹500:

> +500 RP

₹2,000:

> +2,000 RP

For foreign-currency payments, convert the captured payment to its INR base value and derive Rank Points from that.

Razorpay exposes a `base_amount` for non-INR payments representing the converted amount used for fees and settlement, and Indian Razorpay settlements are made in INR.

Therefore:

```text
INR payment:
rankPoints = amountInPaise / 100

USD payment:
rankPoints = Razorpay base_amount in INR paise / 100
```

Round down to an integer.

This prevents currency arbitrage from affecting rankings.

---

# 4. Currency rules

### Visitor located in India

Default:

> INR ₹

Minimum:

> ₹100

Suggested presets:

> ₹100
> ₹250
> ₹500
> ₹1,000
> ₹2,500
> Custom

### Visitor outside India

Default:

> USD $

Minimum:

> $1

Suggested presets:

> $1
> $5
> $10
> $25
> $50
> Custom

Allow an international visitor to manually switch:

> USD ↔ INR

Do not automatically switch currency again after they manually select one.

Save their preference in a cookie/local preference.

### Important distinction

**Founder country ≠ checkout currency country.**

Founder country determines leaderboard placement.

Visitor IP/location determines default payment currency.

These are separate concepts.

---

# 5. Location detection

On initial request:

```text
if geo.country === "IN":
    currency = INR
else:
    currency = USD
```

Use your hosting provider's country header/IP geolocation.

Do not store precise IP addresses unless required for security logs.

Store only things such as:

```text
country_code = IN
```

when needed.

If location cannot be determined:

> Default USD

but provide the INR switch.

---

# 6. Recommended technical stack

Optimize for a solo developer and fast iteration.

### Application

**Next.js + TypeScript**

Use the latest stable release when implementation begins.

Use:

* App Router
* Server Components where useful
* Route handlers/server actions for backend operations

### Styling

**Tailwind CSS**

Do not install a giant component library.

Build around 10–15 reusable components yourself.

### Database

**PostgreSQL**

Recommended easiest setup:

**Supabase**

Use Supabase for:

* PostgreSQL
* Authentication
* Avatar storage
* Row Level Security

### Hosting

**Vercel**

### Payment gateway

**Razorpay**

### Analytics

Use something lightweight such as:

* PostHog for product funnels
* Vercel Analytics/Web Vitals for performance

### Error monitoring

Sentry or equivalent.

---

# 7. Overall architecture

```text
Browser
   ↓
Next.js
   ↓
┌───────────────────┐
│ Application layer │
└───────────────────┘
   ↓            ↓
Supabase       Razorpay
Postgres       Payments
Auth              ↓
Storage        Webhook
   ↑              ↓
   └──── Next.js API ────┘
```

The browser should NEVER be allowed to directly award Rank Points.

All payment and ranking mutations happen server-side.

---

# 8. Authentication

Keep authentication simple.

Start with:

**Google login**

and

**GitHub login**

Plus optional email magic link.

Do not build passwords yourself.

Do not add X authentication initially.

Users can manually add their X profile to their FounderRank profile.

---

# 9. Signup flow

User clicks:

> Join FounderRank

### Step 1

Authenticate.

### Step 2

Choose unique username.

Example:

> founderrank.com/aryan

Validation:

* 3–30 characters
* lowercase
* numbers allowed
* `_` allowed
* reserved names blocked

Block names such as:

```text
admin
api
founders
login
signup
about
privacy
terms
pricing
settings
support
```

### Step 3

Basic profile.

Required:

* Full name
* Username
* Country
* One-line description

Optional:

* Profile photo
* Website
* X
* LinkedIn
* GitHub

### Step 4

Add what you're building.

User can skip this.

### Step 5

Profile goes live.

---

# 10. Founder profile data

A profile should contain:

```text
id
auth_user_id
username
full_name
avatar_url

headline
bio

country_code

website_url
x_url
linkedin_url
github_url

contact_type
contact_value

total_rank_points

created_at
updated_at

is_verified
is_suspended
```

Keep `headline` short.

Example:

> Building AI tools for developers.

Bio maximum approximately 300–500 characters.

FounderRank should not become LinkedIn.

---

# 11. Projects and businesses

Do not make separate complicated database systems for projects and businesses.

Use one entity:

## Ventures

Fields:

```text
id
founder_id

type
name
description
url
logo_url

status
sort_order

created_at
updated_at
```

`type`:

```text
PROJECT
BUSINESS
```

Example profile:

> ### Building
>
> FounderRank
> Social discovery for founders
> founderrank.com

and:

> ### Business
>
> ABC Labs
> AI development studio
> abclabs.com

Limit initially to perhaps:

> 5 ventures per founder

You can increase this later.

---

# 12. Direct connection system

Do NOT build FounderRank messaging.

Founder selects a preferred contact method:

```text
Website
X
LinkedIn
Email
```

Profile displays:

> Connect

Clicking Connect opens the founder's chosen destination.

Example:

```text
X → founder's X profile
LinkedIn → founder's LinkedIn
Email → mailto
Website → website
```

Track the click.

Store:

```text
founder_id
link_type
timestamp
```

Then later FounderRank can tell founders:

> 187 people visited your website this month.

That gives paid ranking measurable value.

---

# 13. Database structure

Recommended tables:

## profiles

Founder identity.

## ventures

Projects/businesses.

## boost_orders

Every attempted boost.

Fields:

```text
id
founder_id

requested_amount
requested_currency

razorpay_order_id

status

created_at
completed_at
```

Statuses:

```text
CREATED
PAID
FAILED
REFUNDED
DISPUTED
```

---

## payments

Actual Razorpay payment records.

```text
id
boost_order_id
founder_id

razorpay_payment_id
razorpay_order_id

currency
amount_subunit

base_currency
base_amount_subunit

rank_points_awarded

status
captured_at

created_at
```

`razorpay_payment_id` must be unique.

---

## rank_ledger

Never modify scores without recording why.

```text
id
founder_id

points
type

payment_id
reason

created_at
```

Types:

```text
PAYMENT
REFUND
CHARGEBACK
ADMIN_ADJUSTMENT
```

Example:

```text
+500 PAYMENT
-500 REFUND
```

This gives you a complete audit trail.

---

## daily_scores

```text
founder_id
date_utc
points
updated_at
```

Unique:

```text
(founder_id, date_utc)
```

Used for fast Today leaderboards.

---

## reports

For reporting fake/abusive profiles.

```text
id
reporter_id
profile_id
reason
details
status
created_at
```

---

## click_events

Website/contact/social clicks.

---

## audit_logs

Important administrative actions.

---

# 14. Database indexes

Create indexes for:

```text
profiles(total_rank_points DESC)
profiles(country_code, total_rank_points DESC)

daily_scores(date_utc, points DESC)

profiles(username)
profiles(country_code)

payments(razorpay_payment_id)
boost_orders(razorpay_order_id)
```

Without these, leaderboard queries become unnecessarily expensive later.

---

# 15. Ranking algorithm

## All-Time Global

Order founders by:

```text
total_rank_points DESC
```

Tie breaker:

```text
timestamp_when_score_was_reached ASC
```

Meaning:

If two founders have 1,000 points, whoever reached 1,000 first remains above.

---

## Country All-Time

```text
WHERE country_code = selectedCountry
ORDER BY total_rank_points DESC
```

---

## Today Global

Use today's UTC `daily_scores`.

---

## Today Country

Join daily scores with profiles and filter by country.

---

# 16. Calculating the next rank

Suppose:

```text
#5 Sarah    760 RP
#6 Aryan    690 RP
```

Aryan needs:

```text
760 - 690 + 1
= 71 RP
```

Display:

> **71 RP to take #5**

Then translate that to an estimated payment:

India:

> About ₹71 required

But because minimum payment is ₹100:

> **₹100 minimum boost → estimated #5**

For USD:

Convert required RP using the current approximate INR/USD conversion for UI estimation.

Always call it:

> Estimated rank

because another founder could boost while checkout is occurring.

---

# 17. Payment UX

Founder clicks:

> Boost Rank

Modal/page:

> **Boost your FounderRank**
>
> Current:
>
> 🌍 #84 Global
> 🇮🇳 #11 India
>
> Choose amount
>
> ₹100
> ₹250
> ₹500
> ₹1,000
>
> Custom ₹____
>
> **Continue**

Below:

> Rank is determined by paid Rank Points. Your final position may change if another founder boosts at the same time.

Keep this extremely simple.

---

# 18. Razorpay backend flow

Never create the trusted order amount entirely from frontend values.

### Step 1 — Frontend request

```text
POST /api/boost/create
```

Payload:

```text
amount
currency
```

Founder ID comes from authenticated session.

---

### Step 2 — Server validates

For INR:

```text
amount >= ₹100
```

For USD:

```text
amount >= $1
```

Reject unsupported currency.

---

### Step 3 — Server creates internal boost_order

Status:

```text
CREATED
```

---

### Step 4 — Create Razorpay Order

Razorpay's Orders API accepts an amount and currency, with amounts represented in currency subunits; for example $1 is sent as `100`.

Therefore:

₹100:

```text
amount = 10000
currency = INR
```

$1:

```text
amount = 100
currency = USD
```

Attach notes:

```text
founder_id
boost_order_id
```

---

# 19. Razorpay Checkout

Open Razorpay Standard Checkout.

Pass:

* Razorpay Order ID
* Founder name
* Founder email
* Currency
* Amount

Razorpay specifically recommends creating an Order before checkout because it ties the payment to the order and prevents payment tampering issues.

---

# 20. Payment confirmation

After checkout succeeds:

Frontend receives:

```text
razorpay_payment_id
razorpay_order_id
razorpay_signature
```

Send them to:

```text
POST /api/boost/verify
```

Server verifies the signature.

However:

**Do not rely exclusively on the browser callback.**

Use Razorpay webhook confirmation as the authoritative backend event.

Razorpay recommends webhooks for server-side payment state changes; `order.paid` and `payment.captured` correspond to captured successful payments.

---

# 21. Razorpay webhook

Endpoint:

```text
POST /api/webhooks/razorpay
```

Verify webhook signature before processing.

Listen primarily for:

```text
order.paid
payment.captured
payment.refunded
```

Use idempotency.

Before awarding points:

```text
if razorpay_payment_id already processed:
    return success
```

This prevents duplicate points from webhook retries.

---

# 22. Awarding Rank Points

Inside one database transaction:

1. Insert payment.
2. Calculate Rank Points.
3. Add ledger entry.
4. Increase profile total.
5. Increase today's score.
6. Mark boost order PAID.

All six must succeed together.

If the transaction fails:

> no partial ranking update.

---

# 23. Refund handling

If a payment is refunded:

```text
original +500 RP
refund   -500 RP
```

Do not delete the original payment.

Create a negative ledger entry.

Recalculate:

* All-Time score
* Today score when relevant

The same principle applies to chargebacks/disputes.

---

# 24. International Razorpay requirement

Do not assume USD checkout will automatically work on a new Razorpay account.

Razorpay says accepting currencies other than INR requires International Payments to be enabled, and international cards are subject to approval/security checks.

Apply for international payment activation before launch.

Razorpay also requires appropriate website/legal information for international-card enablement, including pages such as Terms, Privacy, Refund/Cancellation and Shipping policy.

So payment onboarding is part of the launch checklist, not something to leave until the end.

---

# 25. Homepage

This should be the most important page.

Keep it almost aggressively simple.

## Header

Left:

> **FounderRank**

Right:

> About
> Sign in

Authenticated:

> Dashboard
> Profile avatar

No giant navigation menu.

---

## Intro

Something like:

> # FounderRank
>
> **The leaderboard for founders.**
>
> Discover who's building what.

Then small text:

> Founders compete for visibility through paid Rank Points.

CTA:

> Join FounderRank

---

## Leaderboard controls

Row one:

`All-Time` `Today`

Row two:

`🌍 Global` `[Country ▼]`

No sidebar.

No complicated filter panel.

---

## Leaderboard

Example:

> **#1**
>
> [avatar] **Alex Morgan** 🇺🇸
> Building Acme AI
> `12,481 RP`
>
> Website · Profile
>
> **Boost yourself**

Divider.

> **#2**
>
> [avatar] **Sarah Chen** 🇸🇬
> Founder of DesignFlow
> `11,940 RP`

Repeat.

Desktop can look table-like.

Mobile should become stacked rows.

---

# 26. Do not overload leaderboard rows

Each row should show only:

* Rank
* Avatar
* Founder name
* Country flag
* Short headline
* Main venture
* Rank Points
* Profile link

Nothing else.

Don't show five social icons in every leaderboard row.

Those belong on the profile.

---

# 27. Founder profile page

URL:

```text
founderrank.com/aryan
```

Layout:

> [Avatar]
>
> # Aryan Sharma
>
> 🇮🇳 India
>
> Building useful products on the internet.
>
> **🌍 #42 Global · 🇮🇳 #6 India**
>
> [Connect] [Website]
>
> X · LinkedIn · GitHub
>
> ---
>
> ## Building
>
> **Project One**
> Short description
> projectone.com
>
> **Project Two**
> Short description
>
> ---
>
> ## Business
>
> **ABC Labs**
> AI software company
>
> ---
>
> **1,840 Rank Points**
>
> [Boost your rank]

That's enough.

Do not add:

* Cover photos
* Skills
* Endorsements
* Work history
* Education
* Recommendations
* Long résumé sections

FounderRank is not LinkedIn.

---

# 28. Dashboard

Private founder dashboard:

> **Your FounderRank**
>
> 🌍 #42 Global
> 🇮🇳 #6 India
>
> 1,840 RP
>
> **Boost Rank**
>
> ---
>
> Profile views
>
> 1,230
>
> Website clicks
>
> 142
>
> Connect clicks
>
> 39
>
> ---
>
> Edit profile
> Manage projects

Again: one page.

No sidebar initially.

---

# 29. Profile editor

Sections:

### Basic

* Avatar
* Name
* Username
* Country
* Headline
* Bio

### Links

* Website
* X
* LinkedIn
* GitHub

### Connect

Select preferred:

* Website
* X
* LinkedIn
* Email

### What I'm building

Add/edit ventures.

One Save button.

---

# 30. Country changes

Country leaderboard can be gamed.

Example:

Someone sees:

> USA #140

and changes profile country to a country with three users.

Therefore:

Allow country changes only infrequently.

Recommended:

> One country change per 30 days.

Display:

> Country affects your regional FounderRank.

Record every change in audit logs.

Later, if abuse becomes meaningful, introduce:

> Verified country

Do not build complicated verification now.

---

# 31. Simple UI design system

The visual direction should be:

**Outbid-like simplicity, but slightly more polished.**

### Background

Pure or near white.

```text
#FFFFFF
```

### Primary text

Almost black.

```text
#111111
```

### Secondary text

Neutral gray.

### Borders

Very light gray.

### Primary button

Black background.

White text.

### Accent

Use very little accent color.

Country flags and rank movement can provide most visual color.

No gradients.

No neon.

No glassmorphism.

No giant colorful hero artwork.

No illustrations.

No animated backgrounds.

---

# 32. No dark mode

FounderRank should support **light mode only**.

Do not:

* Detect system dark mode
* Add a theme switcher
* Maintain separate dark colors

Set:

```css
color-scheme: light;
```

Keep the entire experience consistent.

This reduces both UI complexity and design maintenance.

---

# 33. Typography

Use one clean system-oriented sans-serif font.

Examples:

* Inter
* Geist
* system-ui

Don't use multiple font families.

Suggested:

```text
Body: 15–16px
Small: 13–14px
H1: 28–36px
H2: 20–24px
```

Do not make the homepage headline enormous.

FounderRank should feel dense enough to browse quickly.

---

# 34. Layout

Recommended desktop max width:

```text
800–960px
```

Centered.

This is intentionally narrower than typical SaaS websites.

The leaderboard is the focus.

Desktop:

```text
          FounderRank

     The leaderboard for founders.

      [All-Time] [Today]
     [Global] [Country ▼]

---------------------------------
#1  Alex Morgan            12,481
    Building Acme
---------------------------------
#2  Sarah Chen             11,940
    Founder of DesignFlow
---------------------------------
```

Lots of whitespace.

Thin horizontal dividers.

Very few cards.

---

# 35. Interaction design

Use subtle interaction only.

Button hover:

> slightly darker/lighter

Leaderboard row hover:

> very subtle gray background

Transitions:

> ~100–150ms

No bouncing.

No excessive confetti.

For payment success, one small moment is enough:

> **You moved from #18 → #11 ↑**

Then:

> View leaderboard

---

# 36. Mobile

FounderRank must be excellent on mobile.

Prioritize:

* leaderboard browsing
* profile viewing
* boost checkout

Use:

* full-width rows
* 16px minimum inputs
* 44px+ touch targets
* no horizontal scrolling
* responsive amount presets

Payment modal should become a bottom sheet/full-screen panel if necessary.

---

# 37. Public transparency

Near the leaderboard, state clearly:

> **How ranking works**
>
> Rank is determined by paid Rank Points. Paying for Rank Points increases visibility; ranking does not represent FounderRank's endorsement or an objective measure of founder quality.

This protects trust.

Don't hide the fact that ranking is paid.

That fact is actually the game mechanic.

---

# 38. About page

Very short.

Explain:

* What FounderRank is
* How ranking works
* What profiles are for
* What Rank Points mean
* How country ranking works
* Payments
* Refund policy

Keep it readable in under two minutes.

---

# 39. Required legal pages

Before Razorpay live/international approval, prepare:

```text
/about
/contact
/pricing
/terms
/privacy
/refunds
/shipping
```

For Shipping:

> FounderRank provides a digital service and does not ship physical goods.

Have an Indian lawyer/accountant review the actual commercial/tax language before launch, especially for international payments.

---

# 40. SEO

Founder profiles can become your strongest organic acquisition channel.

Every public founder profile should be server-rendered/indexable.

Title example:

> Aryan Sharma — Founder in India | FounderRank

Description:

> Discover Aryan Sharma, founder of ABC and creator of XYZ.

Use canonical URLs.

Generate:

```text
/sitemap.xml
/robots.txt
```

Add structured data where appropriate:

`Person`

with:

* name
* image
* URL
* sameAs social links

---

# 41. Social sharing

Every founder profile should have:

> Share

Generate Open Graph images dynamically.

Example card:

```text
FounderRank

ARYAN SHARMA

#6 Founder in India
#42 Global

Building ProjectXYZ
```

Clean white design.

No giant artwork.

This could become one of the main acquisition loops.

---

# 42. Rank sharing

After payment:

> **You climbed 7 positions**
>
> #18 → #11 India
>
> [Share on X]
> [Copy link]

Generated social text could be:

> Just reached #11 on FounderRank 🇮🇳
> Building ProjectXYZ.

Don't automatically post anything.

---

# 43. Activity

Do not build a social-media feed yet.

You may have a tiny system-generated activity section:

> Alex moved to #1
> Sarah joined FounderRank
> Aryan entered India's Top 10

No user posts.

No comments.

No likes.

No reposts.

No algorithmic feed.

Those features can wait until FounderRank proves that people care about the ranking/profile loop.

---

# 44. Search

Add simple founder search.

Search:

* name
* username
* venture name

UI:

> Search founders…

No advanced filters other than country.

---

# 45. Pagination

Do not load thousands of founders at once.

Leaderboard:

> Top 50 initially

Then:

> Load more

Use cursor pagination rather than huge offset queries at scale.

---

# 46. Founder verification

Do not make verification required at launch.

Potential verification later:

> ✓ Verified Founder

Possible verification sources:

* Website domain
* GitHub
* LinkedIn
* X
* company email

For MVP:

email/account authentication + report abuse.

---

# 47. Impersonation protection

Profiles should have:

> Report profile

Admin can suspend impersonators.

Reserve known/high-profile usernames where necessary.

Keep a manual process initially.

---

# 48. Content rules

Disallow:

* impersonation
* illegal businesses
* scams
* malware/phishing
* explicit content
* hate/extremist content
* misleading external links
* spam profiles

Create basic Terms and community rules.

---

# 49. URL security

Validate every external URL.

Allow only:

```text
https://
http://
```

Do not allow:

```text
javascript:
data:
```

Use safe external links:

```html
rel="noopener noreferrer"
```

---

# 50. Input security

Sanitize/escape:

* Founder names
* Bios
* Headlines
* Venture descriptions

Do not render arbitrary HTML from users.

Plain text only initially.

---

# 51. API security

Rate-limit:

```text
signup
username checks
profile updates
search
payment creation
payment verification
reporting
click tracking
```

Server verifies authenticated ownership before editing a profile.

Never accept:

```text
founderId
rankPoints
paymentStatus
```

from the browser as trusted values.

---

# 52. Database security

Use Supabase Row Level Security.

Public:

> read active founder profiles

Authenticated founder:

> modify only own profile

Ventures:

> modify only ventures linked to own profile

Payments:

> user can read own transactions

Users cannot manually update:

```text
total_rank_points
payment status
rank ledger
admin fields
```

Only trusted backend/service role can do that.

---

# 53. Admin panel

Build a hidden `/admin` panel.

Only admin accounts.

Functions:

### Founders

* Search users
* View profile
* Suspend
* Unsuspend
* Verify
* View reports

### Payments

* Search Razorpay payment ID
* View amount/currency
* View awarded points
* View payment status

### Ranking

* Inspect ledger
* Add audited manual adjustment if absolutely necessary

### Reports

* Review abuse reports
* Remove content

### System

* View failed webhooks
* Retry processing

Do not build a beautiful admin dashboard.

Functionality first.

---

# 54. Analytics events

Track important funnel events:

```text
homepage_view
leaderboard_country_changed
founder_profile_view
venture_clicked
connect_clicked

signup_started
signup_completed
profile_completed

boost_opened
boost_amount_selected
checkout_started
payment_success
payment_failed

share_rank_clicked
```

Main funnel:

```text
Visitor
↓
Founder profile
↓
Signup
↓
Profile complete
↓
Boost opened
↓
Checkout
↓
Payment
```

---

# 55. Founder analytics

Show founders:

```text
Profile views
Website clicks
Connect clicks
```

Later:

```text
Views resulting from boosted ranking
```

That becomes important because it proves:

> “I paid ₹500 and got 300 profile views.”

That converts ego spending into partially measurable marketing spending.

---

# 56. Performance

Homepage leaderboard needs to feel instant.

Target:

* minimal JavaScript
* server-render leaderboard
* optimized avatars
* no heavy animation packages
* no video
* no giant image assets

Cache public leaderboard queries briefly.

Example:

> 15–30 second cache

Payments should invalidate the affected ranking cache.

---

# 57. Images

Allow:

* avatar
* venture logo

Nothing more initially.

Compress uploads.

Recommended limits:

```text
avatar <= 2 MB
venture logo <= 2 MB
```

Accept:

```text
JPEG
PNG
WebP
```

Convert/store optimized versions.

---

# 58. Empty states

New founder:

> **You're not ranked yet.**
>
> Boost with ₹100 to enter FounderRank.
>
> [Get ranked]

No projects:

> What are you building?
>
> [Add project]

No founders for selected country:

> No founders from this country yet.
>
> Be the first.

Make empty states useful rather than visually fancy.

---

# 59. Payment failure UX

Don't show raw gateway errors.

Display:

> Payment wasn't completed.
>
> No Rank Points were added.
>
> [Try again]

If Razorpay confirms payment later via webhook, points should still be awarded.

---

# 60. Race conditions

Two founders may try to overtake #1 simultaneously.

Never promise:

> Guaranteed #1.

Say:

> Estimated #1

until payment is captured.

Ranking recalculates after payment.

This keeps the system technically honest.

---

# 61. Payment history

Dashboard:

> **Boost history**

Example:

```text
₹500    +500 RP    Sep 10    Successful
$10     +894 RP    Sep 8     Successful
₹100    +100 RP    Sep 4     Refunded
```

International RP is illustrative based on converted INR value.

Founder should always understand where their score came from.

---

# 62. Pricing page

Keep pricing ridiculously simple.

> # Boost your rank
>
> **India**
>
> Minimum ₹100
>
> **International**
>
> Minimum $1
>
> Outside India, USD is selected automatically. INR can also be selected.
>
> Rank Points are calculated from captured INR-equivalent payment value.

No subscriptions initially.

No Pro plan.

No premium profile.

No five pricing tiers.

The product is pay-as-you-go ranking.

---

# 63. What NOT to build for v1

This is extremely important.

Do not build:

* Dark mode
* Internal chat
* Supporter payments
* Founder payouts
* Followers
* Posts/feed
* Comments
* Likes
* Notifications center
* Teams
* Categories
* State ranking
* City ranking
* Mobile app
* Subscriptions
* AI features
* Advanced verification
* Referral program
* NFTs/tokens
* Badges everywhere

These will distract from testing the only important question:

> **Will founders pay to climb FounderRank?**

---

# 64. Recommended repository structure

```text
src/
  app/
    page.tsx

    [username]/
      page.tsx

    join/
      page.tsx

    dashboard/
      page.tsx

    settings/
      profile/
      ventures/

    pricing/
    about/
    terms/
    privacy/
    refunds/
    shipping/
    contact/

    api/
      boost/
        create/
        verify/

      webhooks/
        razorpay/

      analytics/
      search/

  components/
    header.tsx
    leaderboard.tsx
    leaderboard-row.tsx
    leaderboard-filters.tsx

    founder-avatar.tsx
    founder-rank.tsx

    boost-dialog.tsx
    currency-switcher.tsx

    venture-item.tsx
    connect-button.tsx

    profile-form.tsx

  lib/
    auth.ts
    db.ts
    ranking.ts
    payments.ts
    razorpay.ts
    geo.ts
    validation.ts
    rate-limit.ts

  types/
```

Keep it boring.

Boring architecture is good here.

---

# 65. Environment variables

Example:

```text
NEXT_PUBLIC_APP_URL

SUPABASE_URL
SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY

RAZORPAY_KEY_ID
RAZORPAY_KEY_SECRET
RAZORPAY_WEBHOOK_SECRET

SENTRY_DSN

POSTHOG_KEY
```

Never expose:

```text
RAZORPAY_KEY_SECRET
SUPABASE_SERVICE_ROLE_KEY
RAZORPAY_WEBHOOK_SECRET
```

to the browser.

---

# 66. Implementation milestones

## Milestone 1 — Foundation

Create:

* repository
* Next.js
* TypeScript
* Tailwind
* Supabase
* environment setup
* deployment pipeline
* base light-only layout

Definition of done:

> Empty FounderRank homepage is deployed.

---

## Milestone 2 — Authentication

Implement:

* Google auth
* GitHub auth
* sessions
* protected dashboard
* logout

Definition of done:

> User can create and return to an account.

---

## Milestone 3 — Founder profiles

Implement:

* onboarding
* username
* country
* bio/headline
* avatar
* social links
* public `/username`

Definition of done:

> Founder can publish a profile.

---

## Milestone 4 — Ventures

Implement:

* create project/business
* edit
* delete
* reorder
* display on profile

Definition of done:

> Founder can show what they built/run.

---

## Milestone 5 — Leaderboards

Implement:

* Rank Points
* Global All-Time
* Country All-Time
* Global Today
* Country Today
* deterministic ties
* leaderboard pagination

Definition of done:

> Seed/test founders rank correctly.

---

## Milestone 6 — Razorpay test integration

Implement:

* currency detection
* INR/USD selector
* amount presets
* custom amount
* minimum validation
* Razorpay Orders
* Checkout
* callback verification
* webhook
* rank ledger

Definition of done:

> Razorpay test payment changes the founder's rank exactly once.

---

## Milestone 7 — Payment resilience

Test:

* duplicate webhook
* failed payment
* cancelled checkout
* delayed webhook
* refund
* simultaneous boosts
* payment replay attempts
* unsupported currency
* minimum amount bypass

Definition of done:

> No payment scenario can create incorrect Rank Points.

---

## Milestone 8 — Discovery

Implement:

* founder search
* country selector
* Connect
* website/social clicks
* basic profile analytics

Definition of done:

> Visitor can discover someone useful and contact them.

---

## Milestone 9 — Admin/moderation

Implement:

* reports
* suspension
* payment inspection
* rank ledger inspection
* failed webhook inspection

Definition of done:

> You can operate the site without manually editing the database.

---

## Milestone 10 — Legal + Razorpay production

Complete:

* Terms
* Privacy
* Refund policy
* Pricing
* Contact
* About
* Shipping/digital delivery statement
* Razorpay KYC
* international-payment activation request

Razorpay says international-card activation requires completed KYC and appropriate website policies before approval.

Definition of done:

> Live INR and approved international payment flows work.

---

## Milestone 11 — SEO + sharing

Implement:

* metadata
* sitemap
* canonical URLs
* Person structured data
* OG cards
* rank sharing
* copy profile link

Definition of done:

> Founder profiles look good on Google/X/LinkedIn shares.

---

## Milestone 12 — Polish

Review every screen for:

* spacing
* mobile responsiveness
* loading state
* empty state
* error state
* keyboard navigation
* focus states
* contrast
* button consistency
* copy consistency

Delete unnecessary UI.

If something doesn't help:

> discover → profile → connect → boost → share

remove it.

---

# 67. Testing checklist

### Authentication

* New Google account
* New GitHub account
* Existing account
* Logout
* Protected routes

### Profiles

* Duplicate usernames
* Invalid links
* Missing avatar
* Very long names
* Unicode names
* Changing country
* Suspended profile

### Ranking

* Zero RP
* Same score
* Country filter
* Daily UTC reset
* All-Time score
* Refund
* Concurrent boosts

### Payments

Test:

```text
₹99 → reject
₹100 → allow

$0.99 → reject
$1 → allow
```

Test currency switching.

Test webhook replay.

Test checkout abandonment.

Test failed international card.

### Mobile

Test popular narrow widths.

### Browsers

At minimum:

* Chrome
* Safari
* Firefox
* Edge

---

# 68. Launch data

Do not launch with fake founders.

Invite real founders before public launch.

Aim to have enough legitimate profiles that the leaderboard doesn't look empty.

Their initial profile creation can be free.

Ranking starts at 0 RP until they boost.

You could display unranked founders below ranked founders, but never fabricate payments/ranks.

Trust is important.

---

# 69. Initial homepage hierarchy

Final recommended order:

```text
HEADER

FounderRank
The leaderboard for founders.

[Join FounderRank]

[All-Time] [Today]
[Global] [Country]

TOP 3

FULL LEADERBOARD

LATEST ACTIVITY

HOW FOUNDERRANK WORKS

FOOTER
```

That's it.

No testimonials section.

No 12-feature grid.

No enormous FAQ on homepage.

No investor-style marketing page.

The leaderboard itself is the product.

---

# 70. Latest activity

Simple:

> Rahul joined FounderRank
> Alex entered the Top 10
> Sarah moved to #1 India
> Daniel boosted his rank

Avoid showing every payment amount unless you intentionally want that transparency.

Activity should make the site feel alive without becoming a social feed.

---

# 71. Navigation

Logged out:

> FounderRank · About · Sign in

Logged in:

> FounderRank · Dashboard · Avatar

On mobile:

Do not create a giant hamburger menu unless necessary.

---

# 72. FounderRank's key metric

Don't optimize first for:

> registered users

Optimize for:

## Paying founders per active leaderboard

Supporting metrics:

```text
Profile completion rate
First boost conversion
Average boost size
Repeat boost rate
Profile views per ranked founder
Connect click rate
Share rate after boosting
```

The most important long-term metric is probably:

> **Percentage of paying founders who boost again.**

If people only pay once, ego is a novelty.

If they repeatedly pay after being overtaken, you have the core mechanism.

---

# 73. Product philosophy

Every feature should pass one of these tests:

### Does it help visitors discover founders?

or

### Does it make founders want more visibility?

or

### Does it help visitors understand what a founder is building?

or

### Does it help visitors connect with that founder?

If not:

> don't build it yet.

---

# 74. Final MVP

The first polished public version should contain exactly this:

**Public**

* Homepage
* Global leaderboard
* Country leaderboard
* Today
* All-Time
* Founder search
* Founder profiles
* Projects/businesses
* Website/social links
* Connect
* Latest activity
* About
* Pricing
* Legal pages

**Founder**

* Authentication
* Onboarding
* Profile editing
* Venture editing
* Rank dashboard
* Profile/click analytics
* Boost Rank
* INR/USD checkout
* Payment history
* Rank sharing

**Platform**

* Razorpay
* Payment webhooks
* Rank ledger
* Country detection
* Analytics
* Error monitoring
* Admin dashboard
* Reporting/moderation
* SEO
* Responsive design

That is enough to feel like a complete product without becoming bloated.

---

# 75. Final positioning

I would use something close to:

> # FounderRank
>
> **The leaderboard for founders.**
>
> Discover founders, see what they're building, and connect.

For founders:

> **Show what you're building. Climb the leaderboard.**

And near every leaderboard:

> Rankings are determined by paid Rank Points.

Simple.

Transparent.

Competitive.

---

# 76. The most important design instruction

When developing FounderRank, whenever you're considering adding something because it looks “more premium,” compare it against Outbid's simplicity.

Prefer:

```text
white background
black text
thin borders
good typography
good spacing
fast pages
clear ranking
clear payment CTA
```

over:

```text
gradients
dashboard cards
animations
dark themes
complex navbars
huge illustrations
feature overload
```

FounderRank should feel like **an internet leaderboard that happens to have excellent founder profiles**, not like another generic SaaS template.

That simplicity should be treated as a product requirement, not merely an aesthetic choice.
