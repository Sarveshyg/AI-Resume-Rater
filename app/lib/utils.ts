// app/lib/utils.ts
import clsx, {type ClassValue} from "clsx";
import {twMerge} from "tailwind-merge";

/**
 * Converts a file size in bytes to a human-readable string with appropriate units.
 * @param {number} bytes The size in bytes.
 * @param {number} [decimals=2] The number of decimal places to include.
 * @returns {string} The formatted file size string (e.g., "1.23 MB").
 */

export function cn(...inputs: ClassValue[]){
    return twMerge(clsx(...inputs));
}

export function formatSize(bytes: number, decimals = 2): string {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

export const generateUUID = () => crypto .randomUUID();

