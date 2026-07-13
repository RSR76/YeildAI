import type { Request, Response } from 'express';
export declare class BrokerController {
    getAll(req: Request, res: Response): Promise<void>;
    getById(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
export declare class CropController {
    getAll(req: Request, res: Response): Promise<void>;
}
//# sourceMappingURL=misc.controller.d.ts.map