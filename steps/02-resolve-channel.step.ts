import { EventConfig, Handlers } from "motia";

// Step 02: ResolveChannel
// converts YT handle/name to channel id using the youtube api

export const config: EventConfig = {
    type: "event",
    name: "ResolveChannel",
    subscribes: ["yt.submit"],
    emits: ["yt.channel.resolved", "yt.error"],
    flows: ["yt-titler"],
}

export const handler: Handlers['ResolveChannel'] = async (input: any, { emit, logger, state }: any) => {

    let jobId: string
    let email: string

    try {
        const data = input || {}
        jobId = data.jobId
        const channel = data.channel
        email = data.email

        logger.info('Resolving channel', { jobId, channel })

        const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY

        if (!YOUTUBE_API_KEY) {
            logger.error('Missing YOUTUBE_API_KEY')
            return
        }
        const jobData = await state.get(jobId, 'jobs')

        if (!jobData) {
            logger.error('Job not found here', jobId)
            return
        }

        await state.set(jobId, 'jobs', {
            ...jobData,
            status: 'resolving',
        })

        if (channel.startsWith('@')) {
            const handle = channel.slice(1)
            logger.info('Resolving channel by handle', { handle })
        }
        console.log('Resolving channel', { channel })
        const responseFetch = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${channel}&key=${YOUTUBE_API_KEY}`)
        const dataFetched = await responseFetch.json()

        logger.info('Channel fetched', { dataFetched })

        if (!dataFetched.items) {
            logger.error('Channel not found', { channel })
            return
        }

        const channelId = dataFetched.items[0].id
        const channelName = dataFetched.items[0].snippet.title

        if (!channelId || !channelName) {
            logger.error('Channel not found', { channel })

            await state.set(jobId, 'jobs', {
                ...jobData,
                status: 'failed',
                error: 'Channel not found',
            })
            await emit({ topic: 'yt.error', data: { jobId, email, error: 'Channel not found' } })

            return
        }

        await state.set(jobId, 'jobs', {
            ...jobData,
            channelId,
            channelName,
            status: 'resolved',
        })

        await emit({ topic: 'yt.channel.resolved', data: { jobId, channelId, channelName, email } })

        return

    } catch (error: any) {

        const data = input || {}
        const jobId = data.jobId
        const email = data.email

        logger.error('Error resolving channel', { error })


        if (!jobId || !email) {
            logger.error('Missing job id, channel or email')
            return
        }

        const jobData = await state.get(jobId, 'jobs')

        if (!jobData) {
            logger.error('Job not found', { jobId })
            return
        }
        await state.set(jobId, 'jobs', {
            ...jobData,
            status: 'failed',
            error: error.message,
        })
        if (emit) {
            await emit({ topic: 'yt.error', data: { jobId, error: error.message } })
        }
        return
    }

}
