import {
  entity,
  authenticated,
  uuid,
  text,
  date,
  one,
} from '@microsoft/rayfin-core';
import { anonymous } from '@microsoft/rayfin-core/experimental';
import { Form } from './Form.js';

/**
 * One submission of a form.
 *
 * Anonymous callers may create a submission but never read one: results stay visible only to
 * the form owner (and to a signed-in respondent for their own rows).
 */
@entity()
@anonymous('create')
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.respondent_id),
})
@authenticated('read', {
  policy: (claims, item) =>
    claims.sub.eq(item.owner_id).or(claims.sub.eq(item.respondent_id)),
})
@authenticated('delete', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class FormResponse {
  @uuid() id!: string;
  @date() submittedAt!: Date;
  @text({ optional: true, max: 320 }) respondentEmail?: string;
  @uuid() form_id!: string;
  @one(() => Form) form?: Form;
  /** Absent for anonymous submissions; set to `claims.sub` when the respondent is signed in. */
  @text({ optional: true, max: 200 }) respondent_id?: string;
  @text({ max: 200 }) owner_id!: string;
}
