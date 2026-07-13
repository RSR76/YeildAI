import type { Request, Response } from 'express';
export declare class ForecastController {
    getLatest(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
    getAllLatest(req: Request, res: Response): Promise<void>;
    getCommodities(req: Request, res: Response): Promise<void>;
    getMarkets(req: Request, res: Response): Promise<void>;
    getHistory(req: Request, res: Response): Promise<Response<any, Record<string, any>> | undefined>;
}
//# sourceMappingURL=forecast.controller.d.ts.map