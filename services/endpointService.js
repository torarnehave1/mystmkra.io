import Endpoint from '../models/endpoints.js';

export async function getEndpointUrl(trigger) {
    try {
        const endpoint = await Endpoint.findOne({ trigger });
        if (!endpoint) {
            throw new Error(`No endpoint found for trigger: ${trigger}`);
        }
        return endpoint.url;
    } catch (error) {
        console.error('Error fetching endpoint URL:', error);
        throw error;
    }
}

export async function callEndpoint(trigger) {
    try {
        const url = await getEndpointUrl(trigger);
        if (!url) {
            throw new Error(`No URL found for trigger: ${trigger}`);
        }
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to call endpoint: ${url}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error calling endpoint:', error);
        throw error;
    }
}
