
export interface ExistTask {
    
}

async function cleanupAndExit(task: ExistTask) {
    try {
        
    } catch (error) {
        console.error('run cleanupAndExit error', error);
    } finally {
        process.exit(0);
    }
}

export default function existSafe(task: ExistTask) {
    process.on('SIGINT', () => {
        console.log('Received SIGINT. Cleaning up and exiting...');
        cleanupAndExit(task);
    });
}