import * as tokenizer from "../tokenizer/tokenizer";

export class ConfigManager {
    private options: any;
    private compressedOptions: string;
    private tokens: string[];

    constructor() {
        this.options = {};
        this.compressedOptions = "";
        this.tokens = [];
    }

    async initOptions(options: any) {
        this.options = options || {};
        this.compressedOptions = await this.compressOptions(this.options);
        this.tokens = await this.getTokens(this.compressedOptions);
    }

    // Compress options
    async compressOptions(options: any): Promise<string> {
        if (!options) return "";
        
        // Use JSON.stringify to compress options
        return JSON.stringify(options);
    }

    // Get tokens
    async getTokens(compressedOptions: string): Promise<string[]> {
        if (!compressedOptions) return [];
        
        try {
            // Use tokenizer for tokenization
            const tokenResult = await tokenizer.tokenize(compressedOptions);
            
            // Convert token object to token array
            if (tokenResult && typeof tokenResult === 'object') {
                return Object.keys(tokenResult);
            }
            
            return [];
        } catch (error) {
            console.error("Token generation failed:", error);
            return [];
        }
    }

    // Get options
    getOptions(): any {
        return this.options;
    }

    // Get compressed options
    getCompressedOptions(): string {
        return this.compressedOptions;
    }

    // Get tokens
    getTokensList(): string[] {
        return this.tokens;
    }

    // Update options
    async updateOptions(newOptions: any): Promise<void> {
        this.options = { ...this.options, ...newOptions };
        this.compressedOptions = await this.compressOptions(this.options);
        this.tokens = await this.getTokens(this.compressedOptions);
    }

    // Reset options
    async resetOptions(): Promise<void> {
        this.options = {};
        this.compressedOptions = "";
        this.tokens = [];
    }
}