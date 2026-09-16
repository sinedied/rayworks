import { Form } from './Form.js';
import { FormField } from './FormField.js';
import { FormResponse } from './FormResponse.js';
import { Answer } from './Answer.js';

export type FormsAppSchema = {
  Form: Form;
  FormField: FormField;
  FormResponse: FormResponse;
  Answer: Answer;
};

export const schema = [Form, FormField, FormResponse, Answer];
