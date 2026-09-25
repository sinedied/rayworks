import { Activity } from './Activity.js';
import { ActivityOption } from './ActivityOption.js';
import { Answer } from './Answer.js';
import { Question } from './Question.js';
import { Room } from './Room.js';
import { Vote } from './Vote.js';

export type RayLiveSchema = {
  Room: Room;
  Question: Question;
  Vote: Vote;
  // DAB reads/writes null for a cleared date; the date decorator only accepts Date | undefined.
  Activity: Omit<Activity, 'startedAt'> & { startedAt?: Date | null };
  ActivityOption: ActivityOption;
  Answer: Answer;
};

export const schema = [Room, Question, Vote, Activity, ActivityOption, Answer];
