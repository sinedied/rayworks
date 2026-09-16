import {
  entity,
  authenticated,
  uuid,
  text,
  boolean,
  int,
  set,
  one,
} from '@microsoft/rayfin-core';
import { anonymous } from '@microsoft/rayfin-core/experimental';
import { Form } from './Form.js';

/** The question kinds a form can contain. */
export type FormFieldKind =
  | 'shortText'
  | 'longText'
  | 'number'
  | 'date'
  | 'singleChoice'
  | 'multiChoice';

/**
 * A single question on a form.
 *
 * `owner_id` is denormalized from the parent form because Rayfin policies cannot traverse
 * relationships. `choices` holds a JSON-encoded string array, used only by the choice kinds.
 */
@entity()
@anonymous('read', {
  policy: (_claims, item) => item.isClosed.eq(false),
})
@authenticated('read', {
  policy: (claims, item) =>
    claims.sub.eq(item.owner_id).or(item.isClosed.eq(false)),
})
@authenticated('create', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('update', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
@authenticated('delete', {
  policy: (claims, item) => claims.sub.eq(item.owner_id),
})
export class FormField {
  @uuid() id!: string;
  @text({ min: 1, max: 300 }) label!: string;
  @text({ optional: true, max: 500 }) helpText?: string;
  @set(
    'shortText',
    'longText',
    'number',
    'date',
    'singleChoice',
    'multiChoice',
  )
  kind!: FormFieldKind;
  @text({ optional: true, max: 4000 }) choices?: string;
  @boolean() required!: boolean;
  /**
   * Soft-delete marker. Questions are never hard-deleted while editing because `Answer.field_id`
   * references them; hiding them keeps historical results resolvable.
   */
  @boolean() isDeleted!: boolean;
  /**
   * Mirrors `Form.isClosed`. Duplicated so the read policy can hide the questions of a closed
   * form: policies cannot traverse the relationship to check the parent.
   */
  @boolean() isClosed!: boolean;
  @int() position!: number;
  @uuid() form_id!: string;
  @one(() => Form) form?: Form;
  @text({ max: 200 }) owner_id!: string;
}
