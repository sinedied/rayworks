import { Activity } from './Activity.js';
import { ActivityOption } from './ActivityOption.js';
import { Answer } from './Answer.js';
import { Question } from './Question.js';
import { Room } from './Room.js';
import { Vote } from './Vote.js';
import { QuizRun } from './QuizRun.js';
import { QuizQuestionRun } from './QuizQuestionRun.js';
import { QuizQuestionOption } from './QuizQuestionOption.js';
import { QuizParticipant } from './QuizParticipant.js';
import { QuizQuestionParticipant } from './QuizQuestionParticipant.js';

export type RayLiveSchema = {
  Room: Omit<Room, 'quizRunId' | 'displayedActivityId' | 'displayedQuestionId'> & {
    quizRunId?: string | null;
    displayedActivityId?: string | null;
    displayedQuestionId?: string | null;
  };
  Question: Question;
  Vote: Vote;
  // DAB reads/writes null for a cleared date; the date decorator only accepts Date | undefined.
  Activity: Omit<Activity, 'startedAt' | 'quizQuestionId'> & { startedAt?: Date | null; quizQuestionId?: string | null };
  ActivityOption: ActivityOption;
  Answer: Answer;
  QuizRun: QuizRun;
  QuizQuestionRun: QuizQuestionRun;
  QuizQuestionOption: QuizQuestionOption;
  QuizParticipant: QuizParticipant;
  QuizQuestionParticipant: QuizQuestionParticipant;
};

export const schema = [
  Room, Question, Vote, Activity, ActivityOption, Answer,
  QuizRun, QuizQuestionRun, QuizQuestionOption, QuizParticipant, QuizQuestionParticipant,
];
