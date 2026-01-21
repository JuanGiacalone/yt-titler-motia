import { EventConfig, Handlers } from "motia";
import { ImprovedTitle } from "./04-ai-titler.step"

// Step 05 -
// Sends email with results using Resend

const RESEND_API_KEY = process.env.RESEND_API_KEY
const RESEND_FROM_EMAIL = process.env.RESEND_FROM_EMAIL

export const config: EventConfig = {
    type: "event",
    name: "SendEmail",
    subscribes: ["yt.titles.ready"],
    emits: ["yt.email.sent", "yt.email.error"],
    flows: ["yt-titler"],
}


export const handler: Handlers['SendEmail'] = async (input: any, { emit, logger, state }: any) => {

    const data = input || {}
    const jobId = data.jobId
    const email = data.email
    const channelName = data.channelName
    const improvedTitles = data.improvedTitles
    const jobData = await state.get(jobId, 'jobs')

    try {

        logger.info('Sending email with results', { jobId, email, channelName, titleCount: improvedTitles.length })

        const emailText = generateEmailText(channelName, improvedTitles)

        if (!RESEND_API_KEY || !RESEND_FROM_EMAIL) {
            throw new Error('RESEND_API_KEY or RESEND_FROM_EMAIL is not set')
        }

        await state.set(jobId, 'jobs', {
            ...jobData,
            status: 'email-sent',
            emailSentAt: new Date().toISOString(),
        })

        const response = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${RESEND_API_KEY}`,
            },
            body: JSON.stringify({
                to: email,
                from: RESEND_FROM_EMAIL,
                subject: `YT Title Doctor - Improved Titles for ${channelName}`,
                text: emailText,
            }),
        })

        if (!response.ok) {
            let errorData = await response.json()
            throw new Error(`Failed to send email: ${errorData.error?.message}`)
        }

        const emailResponse = await response.json()

        logger.info('Email sent', { jobId, email, channelName, titleCount: improvedTitles.length, emailResponse })
        await emit({ topic: 'yt.email.sent', data: { jobId, email, channelName, titleCount: improvedTitles.length, emailResponse } })

        await state.set(jobId, 'jobs', {
            ...jobData,
            emailSentAt: new Date().toISOString(),
            emailResponse: emailResponse.id,
            status: 'completed',
        })

        return
    } catch (error) {
        logger.error('Error sending email', { jobId, email, channelName, titleCount: improvedTitles.length })
        await emit({ topic: 'yt.email.error', data: { jobId, email, channelName, titleCount: improvedTitles.length } })
        return
    }
}


function generateEmailText(
    channelName: string,
    improvedTitles: ImprovedTitle[]
): string {

    let text = `YT Title Doctor - Improved Titles for ${channelName}   \n`

    text += `${"=".repeat(60)}\n\n`

    improvedTitles.forEach((title, index) => {
        text += `Video ${index + 1}:\n`
        text += `-----------------\n`
        text += `Original Title: ${title.originalTitle}\n`
        text += `Improved Title: ${title.improvedTitle}\n`
        text += `Rationale: ${title.rational}\n\n`
        text += `Watch: ${title.url}\n\n`
    })

    return text
}