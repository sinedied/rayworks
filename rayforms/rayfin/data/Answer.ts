import {
  entity,
  authenticated,
  anonymous,
  uuid,
  text,
  int,
  one,
} from '@microsoft/rayfin-core';
import { FormField } from './FormField.js';
import { FormResponse } from './FormResponse.js';

/**
 * A single answer within a submission.
 *
 * `value` stores the raw string for scalar kinds and a JSON-encoded string array for
 * `multiChoice`. `fieldLabel` is snapshotted so results stay readable if a question is later
 * renamed or deleted. Anonymous callers may create answers but never read them.
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
export class Answer {
  @uuid() id!: string;
  @text({ optional: true, max: 4000 }) value?: string;
  @text({ max: 300 }) fieldLabel!: string;
  @int() position!: number;
  @uuid() response_id!: string;
  @one(() => FormResponse) response?: FormResponse;
  @uuid() field_id!: string;
  @one(() => FormField) field?: FormField;
  /** Absent for anonymous submissions; set to `claims.sub` when the respondent is signed in. */
  @text({ optional: true, max: 200 }) respondent_id?: string;
  @text({ max: 200 }) owner_id!: string;
}
