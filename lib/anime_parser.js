import axios from 'axios';
import cheerio from 'cheerio';

import {
  generateEncryptAjaxParameters,
  decryptEncryptAjaxResponse,
} from './helpers/extractors/goload.js';
import { extractStreamSB } from './helpers/extractors/streamsb.js';
import { extractFembed } from './helpers/extractors/fembed.js';
import { USER_AGENT, renameKey } from './utils.js';

const BASE_URL = 'https://gogoanime3.co';
const BASE_URL3 = 'https://anitaku.pe/home.html';
const BASE_URL2 = 'https://anitaku.pe/';
const ajax_url = 'https://ajax.gogocdn.net/';
const anime_info_url = 'https://gogoanime3.net/category/';
const anime_movies_path = '/anime-movies.html';
const popular_path = '/popular.html';
const new_season_path = '/new-season.html';
const search_path = '/search.html';
const popular_ongoing_url = `${ajax_url}ajax/page-recent-release-ongoing.html`;
const recent_release_url = `${ajax_url}ajax/page-recent-release.html`;
const list_episodes_url = `${ajax_url}ajax/load-list-episode`;
const seasons_url = 'https://anitaku.pe/sub-category/';

const Referer = 'https://gogoplay.io/';
const goload_stream_url = 'https://embtaku.pro/streaming.php';
export const DownloadReferer = 'https://embtaku.pro/';

const disqus_iframe = (episodeId) =>
  `https://disqus.com/embed/comments/?base=default&f=gogoanimetv&t_u=https%3A%2F%2Fgogoanime.vc%2F${episodeId}&s_o=default#version=cfefa856cbcd7efb87102e7242c9a829`;
const disqus_api = (threadId, page) =>
  `https://disqus.com/api/3.0/threads/listPostsThreaded?limit=100&thread=${threadId}&forum=gogoanimetv&order=popular&cursor=${page}:0:0&api_key=E8Uh5l5fHZ6gD8U3KycjAIAk46f68Zw7C6eW8WSjZvCLXebZ7p0r1yrYDrLilk2F`;

const Genres = [
  'action',
  'adventure',
  'cars',
  'comedy',
  'crime',
  'dementia',
  'demons',
  'drama',
  'dub',
  'ecchi',
  'family',
  'fantasy',
  'game',
  'gourmet',
  'harem',
  'hentai',
  'historical',
  'horror',
  'josei',
  'kids',
  'magic',
  'martial-arts',
  'mecha',
  'military',
  'Mmusic',
  'mystery',
  'parody',
  'police',
  'psychological',
  'romance',
  'samurai',
  'school',
  'sci-fi',
  'seinen',
  'shoujo',
  'shoujo-ai',
  'shounen',
  'shounen-ai',
  'slice-of-life',
  'space',
  'sports',
  'super-power',
  'supernatural',
  'suspense',
  'thriller',
  'vampire',
  'yaoi',
  'yuri',
  'isekai',
];

const cachedDownloadLinks = {};

export const scrapeFembed = async ({ id }) => {
  try {
    const epPage = await axios.get(BASE_URL2 + id);
    const $ = cheerio.load(epPage.data);

    const server = $('.xstreamcdn > a:nth-child(1)').attr('data-video');
    const serverUrl = new URL(server);

    const sources = await extractFembed(serverUrl.href);

    if (!sources) return { error: 'No sources found!! Try different source.' };

    return sources;
  } catch (e) {
    return { error: e.message };
  }
};

export const scrapeStreamSB = async ({ id }) => {
  try {
    const epPage = await axios.get(BASE_URL2 + id);
    const $ = cheerio.load(epPage.data);

    const server = $(
      'div.anime_video_body > div.anime_muti_link > ul > li.streamsb > a'
    ).attr('data-video');
    const serverUrl = new URL(server);

    const res = await extractStreamSB(serverUrl.href);

    if (!res.stream_data) return { error: 'No sources found!! Try different source.' };

    return {
      headers: { Referer: serverUrl.href, 'User-Agent': USER_AGENT },
      data: [{ file: res.stream_data.file }, { backup: res.stream_data.backup }],
    };
  } catch (err) {
    console.log(err);
    return { error: err.message };
  }
};


export const scrapeMP4 = async ({ id }) => {
  let sources = [];
  let sources_bk = [];
  try {
    let epPage, server, $, serverUrl;

    if (id) {
      epPage = await axios.get(BASE_URL2 + id);
      $ = cheerio.load(epPage.data);

      server = $('#load_anime > div > div > iframe').attr('src');
      serverUrl = new URL(server);
    } else throw Error("Episode id not found")

    const goGoServerPage = await axios.get(serverUrl.href, {
      headers: { 'User-Agent': USER_AGENT },
    });
    const $$ = cheerio.load(goGoServerPage.data);

    const params = await generateEncryptAjaxParameters(
      $$,
      serverUrl.searchParams.get('id')
    );

    const fetchRes = await axios.get(
      `
        ${serverUrl.protocol}//${serverUrl.hostname}/encrypt-ajax.php?${params}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'X-Requested-With': 'XMLHttpRequest',
      },
    }
    );

    const res = decryptEncryptAjaxResponse(fetchRes.data);

    if (!res.source) return { error: 'No sources found!! Try different source.' };

    res.source.forEach((source) => sources.push(source));
    res.source_bk.forEach((source) => sources_bk.push(source));

    return {
      Referer: serverUrl.href,
      sources: sources,
      sources_bk: sources_bk,
    };
  } catch (err) {
    return { error: err };
  }
};

export const scrapeSearch = async ({ list = [], keyw, page = 1 }) => {
  try {
    const searchPage = await axios.get(
      `${BASE_URL2 + search_path}?keyword=${keyw}&page=${page}`
    );
    const $ = cheerio.load(searchPage.data);

    $('div.last_episodes > ul > li').each((i, el) => {
      list.push({
        anime_id: $(el).find('p.name > a').attr('href').split('/')[2],
        name: $(el).find('p.name > a').attr('title'),
        img_url: $(el).find('div > a > img').attr('src'),
        status: $(el).find('p.released').text().trim(),
      });
    });

    if (list.length === 0) {
      return { error: 'No results found' };
    }

    return list;
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeRecentRelease = async ({ list = [], page = 1, type = 1 }) => {
  try {
    const mainPage = await axios.get(`
        ${recent_release_url}?page=${page}&type=${type}
        `);
    const $ = cheerio.load(mainPage.data);

    $('div.last_episodes.loaddub > ul > li').each((i, el) => {
      list.push({
        animeId: $(el).find('p.name > a').attr('href').split('/')[1].split('-episode-')[0],
        episodeId: $(el).find('p.name > a').attr('href').split('/')[1],
        name: $(el).find('p.name > a').attr('title'),
        episodeNum: $(el).find('p.episode').text().replace('Episode ', '').trim(),
        subOrDub: $(el).find('div > a > div').attr('class').replace('type ic-', ''),
        imgUrl: $(el).find('div > a > img').attr('src')
      });
    });
    return list;
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};



export const scrapeAnimeList = async ({ list = [], page = 1 }) => {
  try {
    const AnimeList = await axios.get(`${BASE_URL2}/anime-list.html?page=${page}`);
    const $ = cheerio.load(AnimeList.data);

    $('div.anime_list_body > ul.listing > li').each((i, el) => {
      list.push({
        animeTitle: $(el).find('a').html().replace(/"/g, ""),
        animeId: $(el).find('a').attr('href').replace("/category/", ""),
        liTitle: $(el).attr('title')
      });
    });
    return list;
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeAnimeAZ = async ({ list = [], aph, page = 1 }) => {
  try {
    const AnimeAZ = await axios.get(`${BASE_URL2}/anime-list-${aph}?page=${page}`);
    const $ = cheerio.load(AnimeAZ.data);

    $('div.anime_list_body > ul.listing > li').each((i, el) => {
      list.push({
        animeTitle: $(el).find('a').html().replace(/"/g, ""),
        animeId: $(el).find('a').attr('href').replace("/category/", ""),
        liTitle: $(el).attr('title')
      });
    });
    return list;
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeRecentlyAdded = async ({ list = [], page = 1 }) => {
  try {
    const RecentlyAdded = await axios.get(`${BASE_URL3}?page=${page}`);
    const $ = cheerio.load(RecentlyAdded.data);

    $('div.added_series_body.final ul.listing li').each((i, el) => {
      list.push({
        animeId: $(el).find('a').attr('href').split('/')[2],
        animeName: $(el).find('a').text()
      });
    });
    return list;
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeOngoingSeries = async ({ list = [], page = 1 }) => {
  try {
    const OngoingSeries = await axios.get(`${BASE_URL3}?page=${page}`);
    const $ = cheerio.load(OngoingSeries.data);

    $('nav.menu_series.cron ul li').each((i, el) => {
      list.push({
        animeId: $(el).find('a').attr('href').split('/')[2],
        animeName: $(el).find('a').text()
      });
    });
    return list;
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeNewSeason = async ({ list = [], page = 1 }) => {
  try {
    const popularPage = await axios.get(`
        ${BASE_URL2 + new_season_path}?page=${page}
        `);
    const $ = cheerio.load(popularPage.data);

    $('div.last_episodes > ul > li').each((i, el) => {
      list.push({
        animeId: $(el).find('p.name > a').attr('href').split('/')[2],
        animeTitle: $(el).find('p.name > a').attr('title'),
        imgUrl: $(el).find('div > a > img').attr('src'),
        status: $(el).find('p.released').text().trim()
      });
    });
    return list;
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeOngoingAnime = async ({ list = [], page = 1 }) => {
  try {
    const OngoingAnime = await axios.get(`${BASE_URL2}/ongoing-anime.html?page=${page}`);
    const $ = cheerio.load(OngoingAnime.data);

    $('div.main_body div.last_episodes ul.items li').each((i, el) => {
      list.push({
        animeId: $(el).find('p.name > a').attr('href').split('/')[2],
        animeTitle: $(el).find('p.name > a').attr('title'),
        imgUrl: $(el).find('div > a > img').attr('src'),
        status: $(el).find('p.released').text().trim()
      });
    });
    return list;
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeCompletedAnime = async ({ list = [], page = 1 }) => {
  try {
    const CompletedAnime = await axios.get(`${BASE_URL2}/completed-anime.html?page=${page}`);
    const $ = cheerio.load(CompletedAnime.data);

    $('div.main_body div.last_episodes ul.items li').each((i, el) => {
      list.push({
        animeId: $(el).find('p.name > a').attr('href').split('/')[2],
        animeTitle: $(el).find('p.name > a').attr('title'),
        imgUrl: $(el).find('div > a > img').attr('src'),
        status: $(el).find('p.released').text().trim()
      });
    });
    return list;
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapePopularAnime = async ({ list = [], page = 1 }) => {
  try {
    const popularPage = await axios.get(`
        ${BASE_URL2 + popular_path}?page=${page}
       `);
    const $ = cheerio.load(popularPage.data);

    $('div.last_episodes > ul > li').each((i, el) => {
      list.push({
        animeId: $(el).find('p.name > a').attr('href').split('/')[2],
        animeTitle: $(el).find('p.name > a').attr('title'),
        imgUrl: $(el).find('div > a > img').attr('src'),
        status: $(el).find('p.released').text().trim()
      });
    });
    return list;
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeAnimeMovies = async ({ list = [], aph = '', page = 1 }) => {
  try {
    const popularPage = await axios.get(`
        ${BASE_URL2 + anime_movies_path}?aph=${aph.trim().toUpperCase()}&page=${page}
        `);
    const $ = cheerio.load(popularPage.data);

    $('div.last_episodes > ul > li').each((i, el) => {
      list.push({
        animeId: $(el).find('p.name > a').attr('href').split('/')[2],
        animeTitle: $(el).find('p.name > a').attr('title'),
        imgUrl: $(el).find('div > a > img').attr('src'),
        status: $(el).find('p.released').text().trim(),
      });
    });
    return list;
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeTopAiringAnime = async ({ list = [], page = 1 }) => {
  try {
    if (page == -1) {
      let pageNum = 1;
      let hasMore = true;
      while (hasMore) {
        const popular_page = await axios.get(`
                ${popular_ongoing_url}?page=${pageNum}
                `);
        const $ = cheerio.load(popular_page.data);

        if ($('div.added_series_body.popular > ul > li').length == 0) {
          hasMore = false;
          continue;
        }
        $('div.added_series_body.popular > ul > li').each((i, el) => {
          let genres = [];
          $(el)
            .find('p.genres > a')
            .each((i, el) => {
              genres.push($(el).attr('title'));
            });
          list.push({
            animeId: $(el).find('a:nth-child(1)').attr('href').split('/')[2],
            animeTitle: $(el).find('a:nth-child(1)').attr('title'),
            animeImg: $(el)
              .find('a:nth-child(1) > div')
              .attr('style')
              .match('(https?://.*.(?:png|jpg))')[0],
            latestEp: $(el).find('p:nth-child(4) > a').text().trim(),
            animeUrl: BASE_URL2 + '/' + $(el).find('a:nth-child(1)').attr('href'),
            genres: genres,
          });
        });
        pageNum++;
      }
      return list;
    }

    const popular_page = await axios.get(`
        ${popular_ongoing_url}?page=${page}
        `);
    const $ = cheerio.load(popular_page.data);

    $('div.added_series_body.popular > ul > li').each((i, el) => {
      let genres = [];
      $(el)
        .find('p.genres > a')
        .each((i, el) => {
          genres.push($(el).attr('title'));
        });
      list.push({
        animeId: $(el).find('a:nth-child(1)').attr('href').split('/')[2],
        animeTitle: $(el).find('a:nth-child(1)').attr('title'),
        animeImg: $(el)
          .find('a:nth-child(1) > div')
          .attr('style')
          .match('(https?://.*.(?:png|jpg))')[0],
        latestEp: $(el).find('p:nth-child(4) > a').text().trim(),
        animeUrl: BASE_URL2 + '/' + $(el).find('a:nth-child(1)').attr('href'),
        genres: genres,
      });
    });

    return list;
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeGenre = async ({ list = [], genre, page = 1 }) => {
  try {
    genre = genre.trim().replace(/ /g, '-').toLowerCase();

    if (Genres.indexOf(genre) > -1) {
      const genrePage = await axios.get(`${BASE_URL2}genre/${genre}?page=${page}`);
      const $ = cheerio.load(genrePage.data);

      $('div.last_episodes > ul > li').each((i, elem) => {
        list.push({
          animeId: $(elem).find('p.name > a').attr('href').split('/')[2],
          animeTitle: $(elem).find('p.name > a').attr('title'),
          animeImg: $(elem).find('div > a > img').attr('src'),
          releasedDate: $(elem).find('p.released').text().trim(),
          animeUrl: BASE_URL2 + '/' + $(elem).find('p.name > a').attr('href'),
        });
      });
      return list;
    }
    return { error: 'Genre Not Found' };
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

// scrapeGenre({ genre: "cars", page: 1 }).then((res) => console.log(res))

/**
 * @param {string} id anime id.
 * @returns Resolves when the scraping is complete.
 * @example
 * scrapeGoGoAnimeInfo({id: "naruto"})
 * .then((res) => console.log(res)) // => The anime information is returned in an Object.
 * .catch((err) => console.log(err))
 *
 */
export const scrapeAnimeDetails = async ({ id }) => {
  try {
    let epList = [];

    const animePageTest = await axios.get(`https://anitaku.pe/category/${id}`);

    const $ = cheerio.load(animePageTest.data);

    const animeTitle = $('div.anime_info_body_bg > h1').text();
    const animeImage = $('div.anime_info_body_bg > img').attr('src');
    const type = $('div.anime_info_body_bg > p.type > a').first().text();
    const synopsis = $('div.anime_info_body_bg > div.description')
    .map((i, el) => {
      const content = $(el).find('p').length > 0 
        ? $(el).find('p').map((i, p) => $(p).text()).get().join(' ')
        : $(el).text();
      return content;
    })
      .get()
      .join(' ')
      .replace('Plot Summary: ', '');
    const genres = $('div.anime_info_body_bg > p.type:contains("Genre") > a')
      .map((i, el) => $(el).text())
      .get()
      .join(', ');
    const releasedDate = $('div.anime_info_body_bg > p.type:contains("Released")')
      .text()
      .replace('Released: ', '');
    const status = $('div.anime_info_body_bg > p:nth-child(9) > a').text();
    const otherName = $('div.anime_info_body_bg > p:nth-child(10) > a')
      .text()
      .replace('Other name: ', '')
      .replace(/;/g, ',');

    $('div.anime_info_body_bg > p:nth-child(6) > a').each((i, elem) => {
      genres.push($(elem).attr('title').trim());
    });

    const ep_start = $('#episode_page > li').first().find('a').attr('ep_start');
    const ep_end = $('#episode_page > li').last().find('a').attr('ep_end');
    const movie_id = $('#movie_id').attr('value');
    const alias = $('#alias_anime').attr('value');
    const episode_info_html = $('div.anime_info_episodes_next').html();
    const episode_page = $('ul#episode_page').html();

    const html = await axios.get(
      `${list_episodes_url}?ep_start=${ep_start}&ep_end=${ep_end}&id=${movie_id}&default_ep=${0}&alias=${alias}`
    );
    const $$ = cheerio.load(html.data);

    $$('#episode_related > li').each((i, el) => {
      epList.push({
        episodeId: $(el).find('a').attr('href').split('/')[1],
        episodeNum: $(el).find(`div.name`).text().replace('EP ', ''),
      });
    });

    return {
      name: animeTitle.toString(),
      type: type.toString(),
      released: releasedDate.toString(),
      status: status.toString(),
      genres: genres,
      othername: otherName,
      synopsis: synopsis.toString(),
      imageUrl: animeImage.toString(),
      totalEpisodes: ep_end,
      episode_id: epList.reverse(),
      episode_info_html: episode_info_html.trim(),
      episode_page: episode_page.toString().trim(),
    };
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeSeason = async ({ list = [], season, page = 1 }) => {
  try {
    const season_page = await axios.get(`${seasons_url}${season}?page=${page}`);
    const $ = cheerio.load(season_page.data);

    $('div.last_episodes > ul > li').each((i, el) => {
      list.push({
        animeId: $(el).find('div > a').attr('href').split('/')[2],
        animeTitle: $(el).find('div > a').attr('title'),
        imgUrl: $(el).find('div > a > img').attr('src'),
        status: $(el).find('p.released').html().trim(),
      });
    });

    return list;
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeThread = async ({ episodeId, page = 0 }) => {
  try {
    let threadId = null;

    const thread_page = await axios.get(disqus_iframe(decodeURIComponent(episodeId)));
    const $ = cheerio.load(thread_page.data, { xmlMode: true });

    const thread = JSON.parse($('#disqus-threadData')[0].children[0].data);

    if (thread.code === 0 && thread.cursor.total > 0) {
      threadId = thread.response.thread.id;
    }

    const thread_api_res = (await axios.get(disqus_api(threadId, page))).data;

    return {
      threadId: threadId,
      currentPage: page,
      hasNextPage: thread_api_res.cursor.hasNext,
      comments: thread_api_res.response,
    };
  } catch (err) {
    if (err.response.status === 400) {
      return { error: 'Invalid page. Try again.' };
    }
    return { error: err };
  }
};


export const scrapeWatchAnime = async ({ id }) => {
  try {
    let genres = [];
    let epList = [];

    const WatchAnime = await axios.get(`https://anitaku.pe/${id}`);

    const $ = cheerio.load(WatchAnime.data);

    const anime_category = $('div.anime-info a').attr('href').replace('/category/', '')
    const episode_page = $('ul#episode_page').html()
    const movie_id = $('#movie_id').attr('value');
    const alias = $('#alias_anime').attr('value');
    const episode_link = $('div.play-video > iframe').attr('src')
    const gogoserver = $('li.vidcdn > a').attr('data-video')
    const streamsb = $('li.streamsb > a').attr('data-video')
    const xstreamcdn = $('li.xstreamcdn > a').attr('data-video')
    const anime_name_with_ep = $('div.title_name h2').text()
    const ep_num = $('div.anime_video_body > input.default_ep').attr('value')
    const download = $('li.dowloads a').attr('href')
    const nextEpText = $('div.anime_video_body_episodes_r a').text()
    const nextEpLink = $('div.anime_video_body_episodes_r > a').attr('href')
    const prevEpText = $('div.anime_video_body_episodes_l a').text()
    const prevEpLink = $('div.anime_video_body_episodes_l > a').attr('href')

    return {
      video: episode_link,
      gogoserver: gogoserver,
      streamsb: streamsb,
      xstreamcdn: xstreamcdn,
      animeNameWithEP: anime_name_with_ep.toString(),
      ep_num: ep_num,
      ep_download: download,
      anime_info: anime_category,
      movie_id: movie_id,
      alias: alias,
      episode_page: episode_page,
      nextEpText: nextEpText,
      nextEpLink: nextEpLink,
      prevEpLink: prevEpLink,
      prevEpText: prevEpText,

    };
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeSearchPage = async ({ keyw, page }) => {
  try {
    const SearchPage = await axios.get(`${BASE_URL2 + search_path}?keyword=${keyw}&page=${page}`);

    const $ = cheerio.load(SearchPage.data);

    const pagination = $('ul.pagination-list').html()

    return {
      pagination: pagination.replace("selected", "active"),
    }
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapePopularPage = async ({ page }) => {
  try {
    const PopularPage = await axios.get(`${BASE_URL2}/popular.html?page=${page}`);

    const $ = cheerio.load(PopularPage.data);

    const pagination = $('ul.pagination-list').html()

    return {
      pagination: pagination.replace("selected", "active"),
    }
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeCompletedPage = async ({ page }) => {
  try {
    const CompletedPage = await axios.get(`${BASE_URL2}/completed-anime.html?page=${page}`);

    const $ = cheerio.load(CompletedPage.data);

    const pagination = $('ul.pagination-list').html()

    return {
      pagination: pagination.replace("selected", "active"),
    }
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeOngoingPage = async ({ page }) => {
  try {
    const OngoingPage = await axios.get(`${BASE_URL2}/ongoing-anime.html?page=${page}`);

    const $ = cheerio.load(OngoingPage.data);

    const pagination = $('ul.pagination-list').html()

    return {
      pagination: pagination.replace("selected", "active"),
    }
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeMoviePage = async ({ page }) => {
  try {
    const MoviePage = await axios.get(`${BASE_URL2}/anime-movies.html?aph=&page=${page}`);

    const $ = cheerio.load(MoviePage.data);

    const pagination = $('ul.pagination-list').html()

    return {
      pagination: pagination.replace("selected", "active"),
    }
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};


export const scrapeSubCategoryPage = async ({ subCategory, page }) => {
  try {
    const SubCategoryPage = await axios.get(`${BASE_URL2}/sub-category/${subCategory}?page=${page}`);

    const $ = cheerio.load(SubCategoryPage.data);

    const pagination = $('ul.pagination-list').html()

    return {
      pagination: pagination.replace("selected", "active"),
    }
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeRecentPage = async ({ page, type }) => {
  try {
    const RecentPage = await axios.get(`${recent_release_url}?page=${page}&type=${type}`);

    const $ = cheerio.load(RecentPage.data);

    const pagination = $('ul.pagination-list').html()

    return {
      pagination: pagination.replace("selected", "active"),
    }
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeNewSeasonPage = async ({ page }) => {
  try {
    const NewSeasonPage = await axios.get(`${BASE_URL2}/new-season.html?page=${page}`);

    const $ = cheerio.load(NewSeasonPage.data);

    const pagination = $('ul.pagination-list').html()

    return {
      pagination: pagination.replace("selected", "active"),
    }
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeGenrePage = async ({ genre, page }) => {
  try {
    const GenrePage = await axios.get(`${BASE_URL2}/genre/${genre}?page=${page}`);

    const $ = cheerio.load(GenrePage.data);

    const pagination = $('ul.pagination-list').html()

    return {
      pagination: pagination.replace("selected", "active"),
    }
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeAnimeListPage = async ({ page }) => {
  try {
    const AnimeListPage = await axios.get(`${BASE_URL2}/anime-list.html?page=${page}`);

    const $ = cheerio.load(AnimeListPage.data);

    const pagination = $('ul.pagination-list').html()

    return {
      pagination: pagination.replace("selected", "active"),
    }
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};

export const scrapeAnimeAZPage = async ({ aph, page = 1 }) => {
  try {
    const AnimeAZPage = await axios.get(`${BASE_URL2}/anime-list-${aph}?page=${page}`);

    const $ = cheerio.load(AnimeAZPage.data);

    const pagination = $('ul.pagination-list').html()

    return {
      pagination: pagination.replace("selected", "active"),
    }
  } catch (err) {
    console.log(err);
    return { error: err };
  }
};