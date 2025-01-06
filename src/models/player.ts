import { TrackInfo } from './track-info.js';

export interface Player {
    id: string;
    createdAt: Date;
    lastSeen: Date;
    email: string | null;
    level: number;
    name: string;
    trackInfos: TrackInfo[];
}
