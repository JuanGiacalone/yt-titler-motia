import { EventConfig, Handlers } from "motia";
import { string, z } from "zod";

// Step 04: AI Titler
// Uses OpenAI to generate titles for videos

const OPENAI_API_KEY = process.env.OPENAI_API_KEY

const generateUserPrompt = (videos: any[], channelName: string) => {
    return `
    You are a Youtube title optimization expert. Below are ${videos.length} videos from the channel ${channelName}. 
    
    For each title, provide: 
    1. An improved version that is more engaging SEO-friendly and likely to get more clicks.
    2. A brief rattionale (1-2 sentences explaining why the improved title is better)
    3. The original title
    
    Guidelines:
    - Keep the core topic and authenticity.
    - Use action verbs, numbers and specific value propositions.
    - Make it curiosity-inducing without being clickbait.
    - Optimize for searchibilty and clarity.

    Video Titles:
    ${videos.map((video: any) => video.title).join('\n')}

    Provide the response in the following format:
    {
        "titles": [
            {
                "originalTitle": "Original Title",
                "improvedTitle": "Improved Title",
                "rational": "Rational for why the title is better"
            },
            ...
        ]
    }`
}

const generateTitles = async (userPrompt: string) => {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [
                { role: 'system', content: 'You are a youtube SEO and engagement expert who helps creators write better video titles.' },
                { role: 'user', content: userPrompt },
            ],
            temperature: 0.7,
            response_format: {
                type: 'json_object',
            }
        }),
    })
    return response.json()
}

export const config: EventConfig = {
    type: "event",
    name: "GenerateTitles",
    subscribes: ["yt.videos.fetched"],
    emits: ["yt.titles.ready", "yt.titles.error"],
    flows: ["yt-titler"],
}

export interface ImprovedTitle {
    originalTitle: string;
    improvedTitle: string;
    rational: string;
    videoId: string;
    url: string;
}

export const handler: Handlers['GenerateTitles'] = async (input: any, { emit, logger, state }: any) => {

    const jobId = input.jobId
    const channelName = input.channelName
    const videos = input.videos
    const jobData = await state.get(jobId, 'jobs')
    try {

        if (!OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY is not set')
        }




        state.set(jobId, 'jobs', {
            ...jobData,
            status: 'generating titles',
        })

        const userPrompt = generateUserPrompt(videos, channelName)
        let titlesGenerated = await generateTitles(userPrompt)

        if (!titlesGenerated.ok) {
            let errorData = await titlesGenerated.json()
            throw new Error(
                `AI API error: ${errorData.error?.message}|| Unkown AI error`)
            await emit({ topic: 'yt.titles.error', data: { errorData } })
            await state.set(jobId, 'jobs', {
                ...jobData,
                status: 'failed',
                error: errorData,
            })
            return
        }

        const titlesContent = await titlesGenerated.json()
        titlesGenerated = titlesContent.choices[0].message.content

        const parsedTitles = JSON.parse(titlesGenerated)

        const improvedTitles: ImprovedTitle[] = parsedTitles.titles.map((title: any, index: number) => {
            return {
                originalTitle: title.originalTitle,
                improvedTitle: title.improvedTitle,
                rational: title.rational,
                videoId: title.videoId,
                url: videos[index].url,
            }
        })

        logger.info('Titles generated', { improvedTitles })

        await emit({ topic: 'yt.titles.ready', data: { improvedTitles } })
        await state.set(jobId, 'jobs', {
            ...jobData,
            status: 'titles generated',
            titlesGenerated: improvedTitles,
        })


    } catch (error) {

        state.set(jobId, 'jobs', {
            ...jobData,
            status: 'failed',
            error: error,
        })

        logger.error('Error Error generating titles', { error })

        await emit({ topic: 'yt.titles.error', data: { error } })

        return
    }
    finally {
        state.set(jobId, 'jobs', {
            ...jobData,
            status: 'completed',
        })
    }
    return
}    