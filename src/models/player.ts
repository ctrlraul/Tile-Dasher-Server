import { TrackInfo } from './track-info.ts';

export interface Player {
    id: string;
    createdAt: Date;
    lastSeen: Date;
    email: string | null;
    level: number;
    name: string;
    trackInfos: TrackInfo[];
}
