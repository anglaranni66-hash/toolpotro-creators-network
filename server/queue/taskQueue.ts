export interface QueueTask {
  id: string;
  submissionId: string;
  taskType: 'verify_submission';
  payload: any;
  createdAt: number;
}

export interface QueueStatus {
  isProcessing: boolean;
  activeSubmissionId: string | null;
  queuedCount: number;
  completedCount: number;
  failedCount: number;
  lastProcessedAt: string | null;
  averageProcessingTimeMs: number;
}

class InProcessTaskQueue {
  private queue: QueueTask[] = [];
  private isProcessing = false;
  private currentActiveTask: QueueTask | null = null;
  private completedCount = 0;
  private failedCount = 0;
  private lastProcessedAt: string | null = null;
  private processingTimes: number[] = [];
  private workerHandler: ((task: QueueTask) => Promise<void>) | null = null;

  public setWorker(handler: (task: QueueTask) => Promise<void>) {
    this.workerHandler = handler;
    this.processNext();
  }

  public hasSubmission(submissionId: string): boolean {
    if (this.currentActiveTask?.submissionId === submissionId) return true;
    return this.queue.some((t) => t.submissionId === submissionId);
  }

  public enqueue(task: QueueTask): number {
    // Deduplicate: never enqueue the same submission twice while already queued or active
    if (this.currentActiveTask?.submissionId === task.submissionId) {
      return 0;
    }
    const existingIdx = this.queue.findIndex((t) => t.submissionId === task.submissionId);
    if (existingIdx !== -1) {
      return existingIdx + 1;
    }

    this.queue.push(task);
    const position = this.queue.length;
    console.log(
      `[TaskQueue] Enqueued task ${task.id} (Submission: ${task.submissionId}) at position #${position}. Total queued: ${this.queue.length}`
    );
    this.processNext();
    return position;
  }

  public kick(): void {
    this.processNext();
  }

  public getQueuePosition(submissionId: string): number {
    if (this.currentActiveTask?.submissionId === submissionId) {
      return 0;
    }
    const idx = this.queue.findIndex((t) => t.submissionId === submissionId);
    if (idx !== -1) {
      return idx + 1;
    }
    return -1;
  }

  private async processNext(): Promise<void> {
    if (this.isProcessing || this.queue.length === 0 || !this.workerHandler) {
      return;
    }

    this.isProcessing = true;
    const task = this.queue.shift()!;
    this.currentActiveTask = task;
    const startTime = Date.now();

    try {
      console.log(`[TaskQueue] Processing task ${task.id} (Submission: ${task.submissionId}) 1-by-1...`);
      await this.workerHandler(task);
      this.completedCount++;
      const duration = Date.now() - startTime;
      this.processingTimes.push(duration);
      if (this.processingTimes.length > 30) this.processingTimes.shift();
      this.lastProcessedAt = new Date().toISOString();
      console.log(`[TaskQueue] Finished task ${task.id} in ${duration}ms. Remaining in queue: ${this.queue.length}`);
    } catch (err) {
      console.error(`[TaskQueue] Error executing task ${task.id}:`, err);
      this.failedCount++;
    } finally {
      this.currentActiveTask = null;
      this.isProcessing = false;
      setImmediate(() => this.processNext());
    }
  }

  public getStatus(): QueueStatus {
    const avg =
      this.processingTimes.length > 0
        ? Math.round(this.processingTimes.reduce((a, b) => a + b, 0) / this.processingTimes.length)
        : 1200;

    return {
      isProcessing: this.isProcessing,
      activeSubmissionId: this.currentActiveTask?.submissionId || null,
      queuedCount: this.queue.length,
      completedCount: this.completedCount,
      failedCount: this.failedCount,
      lastProcessedAt: this.lastProcessedAt,
      averageProcessingTimeMs: avg,
    };
  }
}

export const taskQueue = new InProcessTaskQueue();
