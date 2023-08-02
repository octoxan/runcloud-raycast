import { Action, ActionPanel, List, getPreferenceValues, Cache } from "@raycast/api";
import { useEffect, useState } from "react";
import fetch, { RequestInit } from "node-fetch";

export interface Preferences {
  apiKey: string;
  apiSecret: string;
}

const cache = new Cache();

export default function Command() {
  const [isLoading, setLoading] = useState(true);
  const [webapps, setWebapps] = useState<WebApp[]>([]);
  const [searchText, setSearchText] = useState("");

  const preferences = getPreferenceValues<Preferences>();

  const apiKey = preferences.apiKey;
  const apiSecret = preferences.apiSecret;

  // Create the basic authentication header value
  const credentials = `${apiKey}:${apiSecret}`;
  const encodedCredentials = Buffer.from(credentials).toString("base64");

  useEffect(() => {
    const fetchServers = async (): Promise<Server[]> => {
      let allServers: Server[] = [];
      let page = 1;

      try {
        while (true) {
          const url = `https://manage.runcloud.io/api/v2/servers?page=${page}`;
          const options: RequestInit = {
            headers: {
              Authorization: `Basic ${encodedCredentials}`,
              accept: "application/json",
              "content-type": "application/json",
            },
          };
          const response = await fetch(url, options);
          const data = await response.json();
          const servers = parseServers(data);
          allServers = allServers.concat(servers);

          if (servers.length === 0) {
            break;
          }

          page++;
        }
      } catch (error) {
        console.error("Error fetching servers:", error);
      }

      return allServers;
    };

    const fetchWebappsForServer = async (serverId: number, server: Server): Promise<WebApp[]> => {
      let allWebapps: WebApp[] = [];
      let page = 1;

      try {
        while (true) {
          const url = `https://manage.runcloud.io/api/v2/servers/${serverId}/webapps?page=${page}`;
          const options: RequestInit = {
            headers: {
              Authorization: `Basic ${encodedCredentials}`,
              accept: "application/json",
              "content-type": "application/json",
            },
          };
          const response = await fetch(url, options);
          const data = await response.json();
          const webapps = parseWebapps(data, server);
          allWebapps = allWebapps.concat(webapps);

          if (webapps.length < 15) {
            // If the number of webapps on this page is less than 15, it means there are no more pages, so break the loop
            break;
          }

          page++;
        }
      } catch (error) {
        console.error(`Error fetching webapps for server ID ${serverId}:`, error);
      }

      return allWebapps;
    };

    const fetchData = async () => {
      setLoading(true);

      // Check if cached data is available
      const cachedDataString = cache.get("webapps");
      if (cachedDataString) {
        const cachedData = JSON.parse(cachedDataString);
        setWebapps(cachedData.data);
        setLoading(false);
        return;
      }

      const servers = await fetchServers();
      const allWebapps: WebApp[] = [];

      for (const server of servers) {
        const webapps = await fetchWebappsForServer(server.id, server);
        allWebapps.push(...webapps);
        await sleep(50); // 10ms delay between requests
      }

      setWebapps(allWebapps);
      setLoading(false);

      // Store the fetched data in the cache
      const dataToCache = {
        data: allWebapps,
      };
      cache.set("webapps", JSON.stringify(dataToCache));
    };

    fetchData();
  }, [apiKey, apiSecret]);

  const filteredWebapps = webapps.filter((webapp) => webapp.name.toLowerCase().includes(searchText.toLowerCase()));

  const sortedWebapps = filteredWebapps.sort((a, b) => a.name.localeCompare(b.name));

  return (
    <List isLoading={isLoading} onSearchTextChange={setSearchText} searchBarPlaceholder="Search webapps..." throttle>
      <List.Section title="WebApps" subtitle={sortedWebapps.length + ""}>
        {sortedWebapps.map((webapp) => (
          <WebAppListItem key={webapp.id} webapp={webapp} />
        ))}
      </List.Section>
    </List>
  );
}

function WebAppListItem({ webapp }: { webapp: WebApp }) {
  return (
    <List.Item
      title={webapp.name}
      subtitle={`${webapp.server.name}`}
      accessories={[
        { text: `${webapp.server.ipAddress}`}
      ]}
      actions={
        <ActionPanel>
          <ActionPanel.Section>
            <Action.OpenInBrowser
              title="Open in Browser"
              url={`https://manage.runcloud.io/servers/${webapp.server.id}/webapplications/${webapp.id}`}
            />
          </ActionPanel.Section>
        </ActionPanel>
      }
    />
  );
}

interface WebApp {
  id: number;
  server_user_id: number;
  server: Server;
  name: string;
  rootPath: string;
  publicPath: string;
  phpVersion: string;
  stack: string;
  stackMode: string;
  type: string;
  defaultApp: boolean;
  alias: null | string;
  pullKey1: string;
  pullKey2: string;
  created_at: string;
}

interface Server {
  id: number;
  name: string;
  provider: string;
  ipAddress: string;
  country_iso_code: string;
  os: string;
  osVersion: string;
  connected: boolean;
  online: boolean;
  agentVersion: string;
  phpCLIVersion: string;
  softwareUpdate: boolean;
  securityUpdate: boolean;
  transferStatus: string;
  created_at: string;
}

function parseServers(data: any): Server[] {
  return data?.data?.map((server: any) => ({
    id: server.id,
    name: server.name,
    provider: server.provider,
    ipAddress: server.ipAddress,
    country_iso_code: server.country_iso_code,
    os: server.os,
    osVersion: server.osVersion,
    connected: server.connected,
    online: server.online,
    agentVersion: server.agentVersion,
    phpCLIVersion: server.phpCLIVersion,
    softwareUpdate: server.softwareUpdate,
    securityUpdate: server.securityUpdate,
    transferStatus: server.transferStatus,
    created_at: server.created_at,
  })) || [];
}

function parseWebapps(data: any, serverData: Server): WebApp[] {
  return data?.data?.map((webapp: any) => ({
    id: webapp.id,
    server_user_id: webapp.server_user_id,
    server: serverData,
    name: webapp.name,
    rootPath: webapp.rootPath,
    publicPath: webapp.publicPath,
    phpVersion: webapp.phpVersion,
    stack: webapp.stack,
    stackMode: webapp.stackMode,
    type: webapp.type,
    defaultApp: webapp.defaultApp,
    alias: webapp.alias,
    pullKey1: webapp.pullKey1,
    pullKey2: webapp.pullKey2,
    created_at: webapp.created_at,
  })) || [];
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
