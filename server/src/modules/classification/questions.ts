import { choice, noul, score } from '@typesafe-ai/sdk';

export const perguntasDoComentario = {
  topic: choice('What is the main subject of `comment`?', {
    service: 'How staff treated the customer: politeness, attention, helpfulness',
    wait_time: 'Queues, delays, slow service, waiting to be attended',
    product_quality: 'Quality, defects or condition of the product or service delivered',
    price: 'Price, value for money, fees, discounts',
    billing_payment: 'Charges, invoices, refunds, payment methods, wrong charges',
    delivery: 'Shipping, delivery time, order tracking, missing items',
    environment: 'Cleanliness, comfort, noise, parking, physical location',
    digital_channels: 'Website, app, online ordering, digital account problems',
    communication: 'Lack of information, unclear communication, no response from the company',
    other: 'None of the subjects above',
  }),
  sentiment: choice('What is the overall sentiment of `comment` toward the company?', {
    positive: 'Satisfied, praising, recommending',
    neutral: 'Factual or indifferent, no clear feeling',
    negative: 'Dissatisfied, complaining, criticizing',
    mixed: 'Clear praise and clear complaint in the same comment',
  }),
  severity: score('How serious is the problem described in `comment`?', [
    'No problem reported, or only praise',
    'Minor annoyance that does not affect the outcome',
    'Real problem that hurt the customer experience but was resolved or has a workaround',
    'Serious problem: financial loss, safety risk, legal threat, or intention to leave the company',
  ]),
  needs_action: noul('Does `comment` describe a specific problem that the company should act on?', {
    true: 'Reports a concrete failure, request, or unresolved issue',
    false: 'Only praise, a general opinion, or nothing actionable',
  }),
};

export type TemaDoComentario = keyof typeof perguntasDoComentario.topic.criteria;
export type SentimentoDoComentario = keyof typeof perguntasDoComentario.sentiment.criteria;

export const TEMAS = Object.keys(perguntasDoComentario.topic.criteria) as TemaDoComentario[];
export const SENTIMENTOS = Object.keys(
  perguntasDoComentario.sentiment.criteria,
) as SentimentoDoComentario[];
