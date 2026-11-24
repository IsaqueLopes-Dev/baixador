declare module 'yt-search' {
  interface YtSearchVideoResult {
    videoId: string;
    url: string;
    title: string;
    seconds: number;
    thumbnail?: string;
    author?: {
      name: string;
    };
  }

  interface YtSearchResult {
    videos: YtSearchVideoResult[];
  }

  function ytSearch(query: string): Promise<YtSearchResult>;
  function ytSearch(opts: { videoId: string }): Promise<YtSearchVideoResult>;
  export = ytSearch;
}
