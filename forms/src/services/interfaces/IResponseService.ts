import type { Answer } from '../../../rayfin/data/Answer';
import type { FormResponse } from '../../../rayfin/data/FormResponse';

/** One question's answer as captured by the public form renderer. */
export interface AnswerDraft {
  fieldId: string;
  fieldLabel: string;
  position: number;
  /** Raw string for scalar kinds; string array for `multiChoice`. */
  value: string | string[];
}

export interface SubmissionResult {
  response: FormResponse;
  answers: Answer[];
}

export interface IResponseService {
  submitResponse(
    form: { id: string; owner_id: string },
    answers: AnswerDraft[]
  ): Promise<SubmissionResult>;
  getResponsesForForm(formId: string): Promise<FormResponse[]>;
  getAnswersForForm(formId: string): Promise<Answer[]>;
  /** Fetches answers for an already-loaded set of responses, avoiding a second response query. */
  getAnswersForResponses(responseIds: string[]): Promise<Answer[]>;
  deleteResponse(responseId: string): Promise<void>;
}
