import { createClient } from 'redis';

export default async function handler(request, response) {
    // Use REDIS_URL if available, otherwise fail gracefully
    if (!process.env.REDIS_URL) {
        console.warn('REDIS_URL not found');
        return response.status(200).json({ count: 1 });
    }

    const client = createClient({
        url: process.env.REDIS_URL
    });

    client.on('error', (err) => console.error('Redis Client Error', err));

    try {
        await client.connect();

        const { userId } = request.body || {};
        const timestamp = Date.now();

        // If we have a userId, update their "last seen" timestamp
        if (userId) {
            // Add or update the user in the sorted set "online_users" with current timestamp as score
            await client.zAdd('online_users', { score: timestamp, value: userId });
        }

        // Remove users who haven't pinged in the last 30 seconds (30000 ms)
        const threshold = timestamp - 30000;
        await client.zRemRangeByScore('online_users', 0, threshold);

        // Get the count of remaining (active) users
        const count = await client.zCard('online_users');

        return response.status(200).json({
            count: count || 1,
            timestamp: timestamp
        });

    } catch (error) {
        console.error('Redis Logic Error:', error);
        return response.status(200).json({ count: 1, error: error.message });
    } finally {
        // Always close the connection to prevent freezing the serverless function
        if (client.isOpen) {
            await client.quit();
        }
    }
}
