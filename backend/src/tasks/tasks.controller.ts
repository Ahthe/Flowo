import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Delete,
  Patch,
  UseGuards,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import { SupabaseGuard } from '../supabase/supabase.guard';
import {
  UpsertJournalEntryDto,
  UpsertPursuitDto,
  UpsertTaskDto,
} from './dto/task.dto';
import { LogProgressDto } from './dto/log-progress.dto';
import { PreferencesDto } from './dto/preferences.dto';

@Controller('tasks')
@UseGuards(SupabaseGuard)
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  findAll(@Req() req: any) {
    return this.tasksService.findAll(this.extractToken(req), req.user.id);
  }

  @Get('pursuits')
  findPursuits(@Req() req: any) {
    return this.tasksService.findPursuits(this.extractToken(req), req.user.id);
  }

  @Get('journal-entries')
  findJournalEntries(@Req() req: any) {
    return this.tasksService.findJournalEntries(
      this.extractToken(req),
      req.user.id,
    );
  }

  @Post()
  upsert(@Req() req: any, @Body() dto: UpsertTaskDto) {
    return this.tasksService.upsert(this.extractToken(req), req.user.id, dto);
  }

  @Post('pursuits')
  upsertPursuit(@Req() req: any, @Body() dto: UpsertPursuitDto) {
    return this.tasksService.upsertPursuit(
      this.extractToken(req),
      req.user.id,
      dto,
    );
  }

  @Post('journal-entries')
  upsertJournalEntry(@Req() req: any, @Body() dto: UpsertJournalEntryDto) {
    return this.tasksService.upsertJournalEntry(
      this.extractToken(req),
      req.user.id,
      dto,
    );
  }

  @Delete('journal-entries/:entryId')
  removeJournalEntry(@Req() req: any, @Param('entryId') entryId: string) {
    return this.tasksService.removeJournalEntry(
      this.extractToken(req),
      req.user.id,
      entryId,
    );
  }

  @Delete('reset-all')
  resetAll(@Req() req: any) {
    return this.tasksService.resetAll(this.extractToken(req), req.user.id);
  }

  @Delete('pursuits/:pursuitId')
  removePursuit(@Req() req: any, @Param('pursuitId') pursuitId: string) {
    return this.tasksService.removePursuit(
      this.extractToken(req),
      req.user.id,
      pursuitId,
    );
  }

  @Delete(':id')
  remove(@Req() req: any, @Param('id') id: string) {
    return this.tasksService.remove(this.extractToken(req), req.user.id, id);
  }

  @Delete('chunk/:chunkId')
  removeChunk(@Req() req: any, @Param('chunkId') chunkId: string) {
    return this.tasksService.removeChunk(
      this.extractToken(req),
      req.user.id,
      chunkId,
    );
  }

  @Delete('instance/:instanceId')
  removeInstance(@Req() req: any, @Param('instanceId') instanceId: string) {
    return this.tasksService.removeInstance(
      this.extractToken(req),
      req.user.id,
      instanceId,
    );
  }

  @Post('instance')
  createInstance(
    @Req() req: any,
    @Body()
    payload: { taskId: string; start: string; end: string; isPinned: boolean },
  ) {
    return this.tasksService.createInstance(
      this.extractToken(req),
      req.user.id,
      payload,
    );
  }

  @Patch('instance/:instanceId/pin')
  pinInstance(
    @Req() req: any,
    @Param('instanceId') instanceId: string,
    @Body('isPinned') isPinned: boolean,
  ) {
    return this.tasksService.pinInstance(
      this.extractToken(req),
      req.user.id,
      instanceId,
      isPinned,
    );
  }

  @Post('log/:taskId')
  logProgress(
    @Req() req: any,
    @Param('taskId') taskId: string,
    @Body() dto: LogProgressDto,
  ) {
    return this.tasksService.logProgress(
      this.extractToken(req),
      req.user.id,
      taskId,
      dto,
    );
  }

  @Get('preferences')
  getPreferences(@Req() req: any) {
    return this.tasksService.getPreferences(
      this.extractToken(req),
      req.user.id,
    );
  }

  @Post('preferences')
  updatePreferences(@Req() req: any, @Body() dto: PreferencesDto) {
    return this.tasksService.updatePreferences(
      this.extractToken(req),
      req.user.id,
      dto,
    );
  }

  private extractToken(req: any): string {
    const [type, token] = req.headers.authorization?.split(' ') ?? [];
    if (type !== 'Bearer') throw new UnauthorizedException('No token found');
    return token;
  }
}
