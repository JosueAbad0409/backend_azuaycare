import { Request } from 'express';

export interface RequestWithUser extends Request {
    user: {
        id: string;
        email: string;
        rol: string;
        carrera_id: string | null;
    };
}