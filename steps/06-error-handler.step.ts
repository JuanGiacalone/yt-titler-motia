import { EventConfig, Handlers } from "motia";

const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL

export const config: EventConfig = {
    type: "event",
    name: "ErrorHandler",
    subscribes: ["yt.titles.error", "yt.email.error", "yt.channel.error", "yt.submit.error"],
    emits: ["yt.error.informed"],
    flows: ["yt-titler"],
}

export const handler: Handlers['ErrorHandler'] = async (input: any, { emit, logger, state }: any) => {
    const data = input || {}
    const jobId = data.jobId
    const error = data.error
    const jobData = await state.get(jobId, 'jobs')
    try {
        logger.error(' Handling Error notification', { jobId, error })
        await emit({ topic: 'yt.error.informed', data: { jobId, error } })

        await state.set(jobId, 'jobs', {
            ...jobData,
            status: 'failed',
            error: error.message,
        })
        if (RESEND_API_KEY && RESEND_FROM_EMAIL) {
            const response = await fetch('https://api.replay.io/v1/emails', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RESEND_API_KEY}`,
                },
                body: JSON.stringify({
                    from: RESEND_FROM_EMAIL,
                    to: jobData.email,
                    subject: 'Error processing job',
                    text: error.message,
                }),
            })
            if (!response.ok) {
                logger.error('Error sending email', { jobId, error })
            }
        } else {
            logger.error('Missing RESEND_API_KEY or RESEND_FROM_EMAIL')
        }

        return

    } catch (error) {
        logger.error('Error handling error notification', { jobId, error })
        await emit({ topic: 'yt.error.informed', data: { jobId, error } })
    }
}