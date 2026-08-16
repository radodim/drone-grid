# Drone Grid — Privacy Policy

**Version:** `pp-2026-08` · **Effective:** 16 August 2026

> **Plain-language summary.** This summary is for readability; the sections below are authoritative.
>
> - Your account is an **email address and a password hash**. We removed the first-name/last-name fields on purpose — we don't want data we don't need.
> - **Telemetry and video pass through our servers live and are never stored.** No flight logs, no recordings.
> - **No ads, no analytics trackers, no sale of data, no profiling.**
> - Emails we send you are strictly transactional (verification, password reset).
> - To exercise any privacy right, email **privacy@drone-grid.com**.

## 1. Who is responsible (controller)

The controller for personal data processed by the hosted Drone Grid service at `drone-grid.com` (the "Service") is **Rado Dimanov**, an individual operating the Service as a non-commercial community project.

Contact: **privacy@drone-grid.com** (privacy requests) · **support@drone-grid.com** (anything else).

If you run your own instance of the open-source Drone Grid software, the person running that instance — not us — is the controller for it; this policy covers only the hosted Service.

## 2. What we process

**2.1 Account and sign-in data** (identity service): your email address (which is also your username), your password stored **only as a salted hash**, the Terms of Service version you accepted, optional two-factor authentication secrets if you enable them, and sign-in/session records (timestamps and, where security event logging applies, IP addresses).

**2.2 Platform data**: an internal account identifier; drones you register (the name you choose, a **hash** of the drone's provisioning secret, timestamps); share links you create (the label you choose, a **hash** of the link token, creation/expiry/revocation timestamps).

**2.3 Live flight data — transient only**: while you operate, telemetry (including GPS position, altitude, battery, flight mode, armed state, and control inputs) and camera video are relayed in real time between your drone, our servers, and the browsers of you and anyone you share a stream with. **This data is never recorded or stored** — it exists only in transit and volatile memory, and is gone the moment the stream ends.

**2.4 Server logs**: like practically every web service, our reverse proxy and services log IP addresses, requested URLs, timestamps, and browser user-agent strings. Logs are kept short-term for security and troubleshooting (see §6).

**2.5 Correspondence**: emails you send to our support and related mailboxes.

**2.6 What we deliberately do not collect**: real names (the fields are removed from registration), phone numbers, postal addresses, payment data (the Service is free), advertising or analytics identifiers, third-party CAPTCHA or tracking services, stored flight logs, or video recordings.

Please don't put personal data into free-text fields such as drone names or share labels — they are meant for labels like "drone1" or "field crew".

## 3. Why we process it (purposes and legal bases)

| Purpose | Data | Legal basis (GDPR) |
|---|---|---|
| Providing your account and the Service (registration, sign-in, drones, shares, live relay) | 2.1, 2.2, 2.3 | Contract — Art. 6(1)(b) |
| Transactional email: address verification, password reset | email address | Contract — Art. 6(1)(b) |
| Security, abuse prevention, rate limiting, troubleshooting | 2.4, security events | Legitimate interests — Art. 6(1)(f): keeping a free community service and its users safe |
| Answering you | 2.5 | Contract / legitimate interests |
| Compliance with legal obligations | as required | Legal obligation — Art. 6(1)(c) |

We send **no marketing email** and make **no automated decisions with legal or similarly significant effects** about you.

## 4. Who receives data (processors and recipients)

We **never sell** personal data and show no advertising. Data is shared only with the infrastructure providers (processors) needed to run the Service, under data-processing agreements:

| Provider | Role | Location / transfer safeguard |
|---|---|---|
| DigitalOcean, LLC | Server infrastructure hosting the Service | EU-U.S. Data Privacy Framework certified; data processing agreement |
| Amazon Web Services (Amazon SES) | Sending transactional email, from the EU (Frankfurt) region | AWS DPA (incorporated in AWS Service Terms); EU-U.S. Data Privacy Framework certified |
| Migadu Ltd. | Support mailboxes | Switzerland — EU adequacy decision |

Beyond processors: people **you** give share links to receive the live streams and telemetry you share; and we may disclose data where the law requires it.

## 5. International transfers

Where a provider involves a transfer outside the EU/EEA, it is covered by an adequacy decision (Switzerland, EU-U.S. Data Privacy Framework) or EU Standard Contractual Clauses incorporated in the provider's data-processing agreement. Provider locations are listed in the table in §4.

## 6. How long we keep data

| Data | Retention |
|---|---|
| Account, drones, share links, consent record | Until your account is deleted (on request — see §9; self-service deletion is on the roadmap) |
| Live telemetry and video | **Not stored** — transit only |
| Server logs | Short rotation — typically days, at most a few weeks |
| Support correspondence | For the duration of the matter, then periodically cleared |
| Email suppression records (addresses that hard-bounced) | Maintained by the email provider to protect recipients and deliverability |

## 7. Cookies and similar technologies

The Service uses **strictly necessary cookies only**: the session cookies of our sign-in system that keep you logged in. Interface preferences are stored locally in your browser. We use **no analytics, advertising, or cross-site tracking cookies** — which is why there is no cookie banner.

## 8. Security

All traffic is encrypted in transit (TLS). Passwords are stored only as salted hashes; drone secrets and share-link tokens are likewise stored only as hashes. Access to production systems is limited to the operator. No internet service can guarantee absolute security; if a personal-data breach occurs, we will notify the supervisory authority and affected users as required by GDPR Articles 33–34.

## 9. Your rights

Under the GDPR you have the right to **access** your data, **rectify** it, have it **erased**, **restrict** processing, receive it in a portable format (**portability**), and **object** to processing based on legitimate interests.

To exercise any of these, email **privacy@drone-grid.com from your registered email address** (that is how we verify it's you). We respond within one month. Account deletion removes your identity data, drones, and share links; the deletion order and scope are documented in the project's public operations runbook.

You also have the right to complain to a data-protection supervisory authority — your local one is fine; any EU authority can receive your complaint.

**Wherever you live**, we extend the same rights to you. For California residents: we do not sell or share personal information as defined by the CCPA/CPRA, and we honor access and deletion requests regardless of statutory applicability.

## 10. Children

The Service requires users to be at least 18 years old. It is not directed at minors, and we do not knowingly process their data. If you believe a minor has created an account, contact us and we will remove it.

## 11. Shared streams: viewers and bystanders

**Viewers** of a share link who have no account are covered by this policy too: we process their server-log data (§2.4) and relay the live stream to them; nothing else.

**Bystanders**: a drone camera may capture people and property on the ground. We never store that footage — it is relayed live and discarded. The user operating the drone and sharing the stream is responsible, as the party controlling the camera, for complying with the privacy and data-protection laws that apply to what they capture and share. This responsibility is part of our [Terms of Service](/terms).

## 12. Changes to this policy

We will update this policy when the Service changes. Each version carries an identifier and effective date at the top; material changes will be announced in the Service or via re-acceptance at sign-in.

## 13. Contact

**privacy@drone-grid.com** · Rado Dimanov · general contact: **admin@drone-grid.com**
