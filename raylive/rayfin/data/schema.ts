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
  Activity: Activity;
  ActivityOption: ActivityOption;
  Answer: Answer;
};

export const schema = [Room, Question, Vote, Activity, ActivityOption, Answer];
