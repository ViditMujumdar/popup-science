/** JSON schema sent to the model (structured output). Our own sanitizer (shared/scene.ts) is what is trusted. */
import { z } from 'zod';
import { KINDS, ANIMS, AXES, SUBJECTS } from '../../shared/scene';

const vec = z.array(z.number());
const ModelObject = z.object({
  kind: z.enum(KINDS),
  part: z.string().nullable().describe('id of the part this object belongs to, or null'),
  label: z.string().nullable().describe('short on-screen label (max 4 words) or null'),
  position: vec.describe('[x, y, z]'),
  rotation: vec.nullable().describe('[x, y, z] in degrees'),
  size: vec.nullable(),
  points: vec.nullable().describe('flat list x1,y1,z1,x2,y2,z2,... for arrow/tube/line'),
  color: z.string().describe('hex colour like #4fe3f0'),
  opacity: z.number().nullable(),
  glow: z.boolean().nullable(),
  double: z.boolean().nullable(),
  count: z.number().nullable(),
  step: z.number().nullable(),
  animation: z.enum(ANIMS).nullable(),
  axis: z.enum(AXES).nullable(),
  speed: z.number().nullable(),
  center: vec.nullable(),
});
export const ModelOutput = z.object({
  understood: z.boolean(),
  notUnderstoodReason: z.string().nullable(),
  kind: z.enum(['diagram', 'homework']).describe('diagram = explain a textbook figure; homework = a question/exercise to solve'),
  grade: z.number().nullable().describe('school class 1-12 the explanation is written for'),
  title: z.string(),
  subject: z.enum(SUBJECTS),
  topic: z.string(),
  gradeLevel: z.string().nullable(),
  summary: z.string(),
  descriptionMarkdown: z.string(),
  parts: z.array(z.object({ id: z.string(), name: z.string(), description: z.string() })),
  steps: z.array(z.object({ title: z.string(), text: z.string(), focus: z.array(z.string()).nullable() })),
  keyTerms: z.array(z.object({ term: z.string(), meaning: z.string() })),
  funFact: z.string().nullable(),
  objects: z.array(ModelObject),
  homework: z.object({
    question: z.string().describe('the question exactly as written'),
    hints: z.array(z.string()).describe('1-3 hints from gentle to strong; never reveal the final answer'),
    answerMarkdown: z.string().describe('the complete final answer, written the way the student should write it in their notebook'),
    checks: z.array(z.object({ label: z.string(), expression: z.string(), claimed: z.number() })).describe('numeric results in the answer as plain arithmetic, re-checked by the app'),
    practice: z.array(z.object({ question: z.string(), answer: z.string() })).describe('1-2 similar practice questions with answers'),
  }).nullable(),
  videoQuery: z.string(),
  warnings: z.array(z.string()),
});
export const modelJsonSchema = () => z.toJSONSchema(ModelOutput);

