import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

type UsageRecord = {
  userId: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

@Injectable()
export class GptUsageService {
  private readonly logger = new Logger(GptUsageService.name);

  constructor(private readonly prisma: PrismaService) {}

  async recordUsage(params: UsageRecord): Promise<void> {
    const userId = String(params.userId || '').trim();
    if (!userId) return;

    const promptTokens = this.normalizeTokenNumber(params.promptTokens);
    const completionTokens = this.normalizeTokenNumber(params.completionTokens);
    const totalTokens = this.normalizeTotalTokens(
      params.totalTokens,
      promptTokens,
      completionTokens,
    );

    if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) {
      return;
    }

    try {
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          openAiPromptTokens: { increment: promptTokens },
          openAiCompletionTokens: { increment: completionTokens },
          openAiTotalTokens: { increment: totalTokens },
          openAiRequestCount: { increment: 1 },
          openAiLastUsedAt: new Date(),
        },
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Unknown GPT usage error';
      this.logger.warn(
        `Failed to record GPT usage for user ${userId}: ${message}`,
      );
    }
  }

  extractChatCompletionUsage(payload: unknown): UsageRecord | null {
    const usage = (payload as any)?.usage;
    if (!usage) return null;

    return {
      userId: '',
      promptTokens: this.pickNumber(
        usage.prompt_tokens,
        usage.input_tokens,
        usage.promptTokens,
        usage.inputTokens,
      ),
      completionTokens: this.pickNumber(
        usage.completion_tokens,
        usage.output_tokens,
        usage.completionTokens,
        usage.outputTokens,
      ),
      totalTokens: this.pickNumber(
        usage.total_tokens,
        usage.totalTokens,
        usage.total,
      ),
    };
  }

  extractLangChainUsage(payload: unknown): Omit<UsageRecord, 'userId'> | null {
    const usageMetadata = (payload as any)?.usage_metadata;
    const tokenUsage = (payload as any)?.response_metadata?.tokenUsage;
    const llmOutput = (payload as any)?.response_metadata?.usage;

    const promptTokens = this.pickNumber(
      usageMetadata?.input_tokens,
      usageMetadata?.prompt_tokens,
      tokenUsage?.promptTokens,
      tokenUsage?.inputTokens,
      llmOutput?.prompt_tokens,
      llmOutput?.input_tokens,
    );
    const completionTokens = this.pickNumber(
      usageMetadata?.output_tokens,
      usageMetadata?.completion_tokens,
      tokenUsage?.completionTokens,
      tokenUsage?.outputTokens,
      llmOutput?.completion_tokens,
      llmOutput?.output_tokens,
    );
    const totalTokens = this.pickNumber(
      usageMetadata?.total_tokens,
      tokenUsage?.totalTokens,
      llmOutput?.total_tokens,
    );

    if (promptTokens === 0 && completionTokens === 0 && totalTokens === 0) {
      return null;
    }

    return {
      promptTokens,
      completionTokens,
      totalTokens,
    };
  }

  private normalizeTokenNumber(value?: number): number {
    const parsed = Number(value || 0);
    if (!Number.isFinite(parsed) || parsed <= 0) return 0;
    return Math.round(parsed);
  }

  private normalizeTotalTokens(
    totalTokens: number | undefined,
    promptTokens: number,
    completionTokens: number,
  ): number {
    const explicitTotal = this.normalizeTokenNumber(totalTokens);
    if (explicitTotal > 0) return explicitTotal;
    return promptTokens + completionTokens;
  }

  private pickNumber(...values: unknown[]): number {
    for (const value of values) {
      const parsed = Number(value);
      if (Number.isFinite(parsed) && parsed > 0) {
        return Math.round(parsed);
      }
    }
    return 0;
  }
}
