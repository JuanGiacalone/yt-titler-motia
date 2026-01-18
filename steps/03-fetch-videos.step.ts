import { EventConfig, Handlers } from "motia";
import { url, z } from "zod";

// Step 03: FetchVideos
// Fetches videos from the channel using the youtube api

export const config: EventConfig = {
    type: "event",
    name: "FetchVideos",
    subscribes: ["yt.channel.resolved"],
    emits: ["yt.videos.fetched", "yt.error"],
    flows: ["yt-titler"],
}

interface FetchVideosRequest {
    jobId: string;
    channelId: string;
    channelName: string;
    email: string;
}

const videoSchema = z.object({
    videoId: z.string(),
    title: z.string(),
    description: z.string(),
    thumbnail: z.string(),
    publishedAt: z.string(),
    url: z.string(),
})

async function fetchVideos(channelId: string) {
    const response = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=5&order=date&channelId=${channelId}&key=${process.env.YOUTUBE_API_KEY}`)
    const data = await response.json()
    return data.items.map((item: any) => {
        return {
            videoId: item.id.videoId,
            title: item.snippet.title,
            description: item.snippet.description,
            thumbnail: item.snippet.thumbnails.high.url,
            publishedAt: item.snippet.publishedAt,
            url: `https://www.youtube.com/watch?v=${item.id.videoId}`,
        }
    })
}

export const handler: Handlers['FetchVideos'] = async (input: FetchVideosRequest, { emit, logger, state }: any) => {

    const channelId = input.channelId
    const channelName = input.channelName
    const jobId = input.jobId
    const email = input.email
    const jobData = await state.get(jobId, 'jobs')

    logger.info('Fetching videos for channel', { channelId, channelName, jobId, email })

    try {
        const videos = await fetchVideos(channelId)
        logger.info('Videos fetched', { videos })

        await state.set(jobId, 'jobs', {
            ...jobData,
            status: 'fetched',
            videos,
        })
        await emit({ topic: 'yt.videos.fetched', data: { channelId, channelName, jobId, videos } })

    } catch (error) {
        logger.error('Error fetching videos', { error })
        await state.set(jobId, 'jobs', {
            ...jobData,
            status: 'failed',
            error: error,
        })
        await emit({ topic: 'yt.error', data: { error } })
    }
}    