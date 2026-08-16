# Privacy operations

Data-subject request (DSR) procedures for the hosted service.

- Contact address: `privacy@drone-grid.com`.
- Deadline: **one month** from the request.
- Identity check: the request must come from the account's registered
  email address.
- Keep a dated log of requests and completions (private note, not in git).

## Erasure (account deletion)

Order matters: the backend re-creates its `user` row from the JWT on any
authenticated request (just-in-time provisioning), so Keycloak goes first.

1. **Keycloak** (via the SSH tunnel): Users → search by email → Delete.
   This ends sessions and removes credentials, attributes, and consent
   records.
2. **Backend DB** (the backend database, not Keycloak's):

   ```sql
   DELETE FROM drone_share
    WHERE creation_user_id = (SELECT id FROM "user" WHERE sub = :sub);
   DELETE FROM "user" WHERE sub = :sub;
   ```

   The `user` delete cascades the user's drones and the shares on those
   drones. The explicit first statement removes shares the user minted on
   *other* users' drones — those are only SET NULL on user deletion and
   would otherwise retain the user-authored label.
3. **Support mailbox**: delete correspondence with the requester unless an
   ongoing matter requires it.
4. Confirm completion to the requester. Server logs need no action — they
   age out on rotation (compose `logging` bounds).

## Export (access / portability)

1. Keycloak: `kcadm.sh get users -r drone-grid -q email=<email>` over the
   tunnel.
2. Backend: `SELECT` the `user` row by `sub`, `drone` rows by
   `creation_user_id`, `drone_share` rows by `creation_user_id`.
3. Send as JSON attachments from `support@drone-grid.com`.

## Re-consent (terms or policy revision)

1. Ship the revised document with a new version id (e.g. `tos-2027-01`)
   and updated effective date.
2. Keycloak → Realm settings → User profile → JSON editor: change the
   `termsAccepted` options value (and the matching `inputOptionLabels`
   key) to the new id.
3. Every existing user now fails profile validation at next sign-in and
   must re-accept before continuing; new registrations record the new id.
4. Mirror the change into both realm JSONs.

## Notes

- Live telemetry and video are never stored — nothing to erase there.
- SES suppression-list entries (hard bounces) are AWS-managed
  deliverability protection, not profile data.
- Self-service deletion (Keycloak `delete_account` action + an automated
  backend cascade) is roadmap; until it ships, this runbook is the
  mechanism.
