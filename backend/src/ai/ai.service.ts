import { HttpException, HttpStatus, Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Groq from 'groq-sdk';
import { ClassifyTaskDto } from './dto/classify-task.dto';
import { TaskClassificationDto } from './dto/task-classification.dto';
import { SupabaseService } from '../supabase/supabase.service';

@Injectable()
export class AiService {
  private groq: Groq;
  constructor(
    private configService: ConfigService,
    private supabaseService: SupabaseService,
  ) {
    const apiKey = this.configService.get<string>('API_KEY');
    if (!apiKey) {
      console.warn('API_KEY is not set. AI features will fail.');
    }
    this.groq = new Groq({ apiKey });
  }

  async classifyTask(
    dto: ClassifyTaskDto,
    userId: string,
    token: string,
  ): Promise<TaskClassificationDto> {
    try {
      const userClient = this.supabaseService.getUserClient(token);

      const systemPrompt = `You are a task time-behavior classifier.
Your Goal: Map natural-language tasks to workload patterns and break them down into concrete, actionable chunks (max 5).
Output: Strict JSON matching the schema below. No chatter.

Schema:
{
  "suggested_chunks": [
    { "title": "string", "description": "string", "estimated_duration_min": integer }
  ]
}

Scale calibration for skill_level '${dto.skill_level}':
- beginner/total_novice: Multiply generic durations by 1.5x. Provide more granular chunks.
- intermediate/average: Baselines.
- advanced/master/expert: Multiply generic durations by 0.7x. Chunks can be broader.

Constraints:
- suggested_chunks: Min 1, Max 5.`;

      const response = await this.groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: `Task: ${dto.task_description}\nSkill Level: ${dto.skill_level}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Empty response from AI');
      }

      let rawData;
      try {
        // Strip markdown code block formatting if present just in case
        const jsonContent = content.replace(/```json/gi, '').replace(/```/g, '').trim();
        rawData = JSON.parse(jsonContent);
      } catch (parseError) {
        console.error('Failed to parse AI output as JSON:', content);
        throw new Error('AI produced invalid JSON output');
      }

      if (!Array.isArray(rawData.suggested_chunks)) {
        rawData.suggested_chunks = [];
      }
      if (rawData.suggested_chunks.length > 5) {
        rawData.suggested_chunks = rawData.suggested_chunks.slice(0, 5);
      }

      // 2. Record Usage Atomically
      const { error: rpcError } = await userClient.rpc('increment_ai_usage', { uid: userId });
      
      if (rpcError) {
        if (rpcError.message.includes('DAILY_LIMIT_REACHED')) {
          throw new HttpException(
            'Daily AI limit reached (3 tasks per day). Try again tomorrow!',
            HttpStatus.TOO_MANY_REQUESTS,
          );
        }
        console.error('Failed to increment usage:', rpcError);
        throw new InternalServerErrorException('Failed to process AI task limit');
      }

      return rawData as TaskClassificationDto;
    } catch (error: any) {
      if (error instanceof HttpException) throw error;
      
      console.error('AI Classification Error:', error.message);
      throw new InternalServerErrorException(
        'AI classification service is temporarily unavailable. Please try again.',
      );
    }
  }
}
