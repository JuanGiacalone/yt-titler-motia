import { ApiRouteConfig, Handler } from "motia";
import { success } from "zod";

// Step 01: SubmitChannel
// Accepts channel name and email to start
// Emits yt.submit event with channel name and email

export const config: ApiRouteConfig = {
    type: "api",
    name: "SubmitChannel",
    path: "/submit",
    method: "POST",
    emits: ["yt.submit"],
    flows: ["yt.submit"],
}

interface SubmitRequest {
    channel: string;
    email: string;
}

export const handler = async (req: any, { emit, logger, state }: any) => {
    try {
        logger.info('Received request to submit channel', { body: req.body });

        const { channel, email } = req.body as SubmitRequest;

        if (!channel || !email) {
            return {
                status: 400,
                body: {
                    success: false,
                    message: 'Missing channel name or email',
                },
            };
        }

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailRegex.test(email)) {
            return {
                body: {
                    success: false,
                    message: 'Invalid email address',
                },
                status: 400,
            };
        }

        const jobId = `job_${Date.now()}_${Math.random().toString(36).substring(2, 15)}`;

        try {
            await state.set('submissions', jobId, {
                jobId,
                channel,
                email,
                status: 'queued',
                createdAt: new Date().toISOString(),
            });
        } catch (error) {
            logger.error(error)
        }

        logger.info('Job added to queue', { jobId, channel, email });

        await emit({ topic: 'yt.submit', payload: { jobId, channel, email } });

        return {
            status: 202,
            body: {
                success: true,
                message: 'Request accepted, job will be processed shortly',
                jobId,
            },
        };

    } catch (error: any) {
        logger.error('Error submitting channel', { error: error.message });

        return {
            status: 500,
            body: {
                success: false,
                message: 'Failed to submit channel',
                error: error.message,
            },
        };
    }
}
