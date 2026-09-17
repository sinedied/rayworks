import {
  AudienceType,
  UserDataFunctions,
  type RayfinContext,
} from '@microsoft/fabric-user-data-functions';

import type { UniversalAppSchema } from '../../data/schema.js';

const udf = new UserDataFunctions();

interface GeneratedReport {
  reportId: string;
  shareId: string;
  summary: string;
  keyTakeaways: string;
}

interface ModelResponse {
  summary: string;
  keyTakeaways: string[];
}

function extractModelText(payload: unknown): string {
  if (!payload || typeof payload !== 'object') {
    throw new Error('Azure Foundry returned an invalid response.');
  }

  const response = payload as {
    output_text?: unknown;
    choices?: Array<{ message?: { content?: unknown } }>;
  };
  const content = response.output_text ?? response.choices?.[0]?.message?.content;

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Azure Foundry response did not contain generated text.');
  }
  return content.trim();
}

function parseModelResponse(content: string): ModelResponse {
  const normalized = content
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '');
  const parsed: unknown = JSON.parse(normalized);

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Azure Foundry returned invalid report JSON.');
  }

  const report = parsed as { summary?: unknown; keyTakeaways?: unknown };
  if (
    typeof report.summary !== 'string' ||
    !Array.isArray(report.keyTakeaways) ||
    !report.keyTakeaways.every((item) => typeof item === 'string')
  ) {
    throw new Error(
      'Azure Foundry report JSON must contain summary and keyTakeaways.'
    );
  }

  return {
    summary: report.summary.trim(),
    keyTakeaways: report.keyTakeaways.map((item) => item.trim()).filter(Boolean),
  };
}

udf.func(
  'generateTripReport',
  async (
    tripId: string,
    ctx: RayfinContext<UniversalAppSchema>
  ): Promise<GeneratedReport> => {
    const endpoint = ctx.getSecret('AZURE_FOUNDRY_ENDPOINT');
    if (!endpoint) {
      throw new Error(
        'AZURE_FOUNDRY_ENDPOINT is not configured for this Rayfin deployment.'
      );
    }
    const modelDeploymentName = ctx.getSecret(
      'AZURE_AI_MODEL_DEPLOYMENT_NAME'
    );
    if (!modelDeploymentName) {
      throw new Error(
        'AZURE_AI_MODEL_DEPLOYMENT_NAME is not configured for this Rayfin deployment.'
      );
    }

    const data = ctx.getDataClient();
    const trips = await data.Trip.select([
      'id',
      'title',
      'destination',
      'purpose',
      'startDate',
      'endDate',
      'owner_id',
    ])
      .where({ id: { eq: tripId } })
      .first(1)
      .execute();
    const trip = trips[0];
    if (!trip) {
      throw new Error('Trip not found or you do not have access to it.');
    }

    const days = await data.TripDay.select(['day', 'title', 'notes'])
      .where({ trip_id: { eq: tripId } })
      .orderBy({ day: 'asc' })
      .first(1000)
      .execute();
    const photos = await data.TripPhoto.select(['caption', 'createdAt'])
      .where({ trip_id: { eq: tripId } })
      .orderBy({ createdAt: 'asc' })
      .first(1000)
      .execute();

    const prompt = [
      `Trip: ${trip.title}`,
      `Destination: ${trip.destination}`,
      `Dates: ${String(trip.startDate)} to ${String(trip.endDate)}`,
      `Purpose: ${trip.purpose || 'Not specified'}`,
      '',
      'Daily notes:',
      ...days.map(
        (entry) =>
          `- ${String(entry.day)}${entry.title ? ` — ${entry.title}` : ''}\n${entry.notes}`
      ),
      '',
      'Photo captions:',
      ...(photos.length
        ? photos.map((photo) => `- ${photo.caption || 'Uncaptioned photo'}`)
        : ['- No photos attached']),
      '',
      'Return only JSON with this shape:',
      '{"summary":"A concise professional trip report.","keyTakeaways":["Actionable takeaway"]}',
    ].join('\n');

    const token = ctx.getToken(AudienceType.AzureAI);
    const response = await fetch(
      `${endpoint.replace(/\/+$/, '')}/chat/completions`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: modelDeploymentName,
          messages: [
            {
              role: 'system',
              content:
                'You create concise, factual business trip reports. Do not invent facts.',
            },
            { role: 'user', content: prompt },
          ],
          temperature: 0.2,
        }),
      }
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(
        `Azure Foundry request failed (${response.status}): ${details.slice(0, 500)}`
      );
    }

    const generated = parseModelResponse(
      extractModelText(await response.json())
    );
    const keyTakeaways = generated.keyTakeaways
      .map((item) => `• ${item}`)
      .join('\n');
    const existing = await data.TripReport.select(['id', 'shareId', 'status'])
      .where({ trip_id: { eq: tripId } })
      .first(1)
      .execute();
    const generatedAt = new Date();

    if (existing[0]) {
      if (existing[0].status === 'finalized') {
        throw new Error('A finalized trip report cannot be regenerated.');
      }
      await data.TripReport.update(
        { id: existing[0].id },
        {
          title: trip.title,
          summary: generated.summary,
          keyTakeaways,
          status: 'draft',
          generatedAt,
        }
      );
      return {
        reportId: existing[0].id,
        shareId: existing[0].shareId,
        summary: generated.summary,
        keyTakeaways,
      };
    }

    const shareId = crypto.randomUUID().replaceAll('-', '');
    const report = await data.TripReport.create({
      title: trip.title,
      summary: generated.summary,
      keyTakeaways,
      status: 'draft',
      shareId,
      generatedAt,
      trip_id: tripId,
      trip: { id: tripId },
      owner_id: trip.owner_id,
    });

    return {
      reportId: report.id,
      shareId,
      summary: generated.summary,
      keyTakeaways,
    };
  },
  [udf.connection({ audienceType: AudienceType.AzureAI })]
);
