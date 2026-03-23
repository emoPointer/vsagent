use serde::Serialize;

/// A parsed SSH host entry from ~/.ssh/config
#[derive(Debug, Clone, Serialize)]
pub struct SshHost {
    /// The Host alias (e.g. "myserver")
    pub name: String,
    /// Resolved HostName (IP or domain), falls back to name
    pub hostname: String,
    /// User, if specified
    pub user: Option<String>,
    /// Port, if specified
    pub port: Option<u16>,
}

/// Parse SSH config file and return a list of hosts.
/// Skips wildcard patterns (Host *) and entries without useful names.
pub fn parse_ssh_config() -> Vec<SshHost> {
    let mut results = Vec::new();

    // Try ~/.ssh/config first
    let home = match dirs::home_dir() {
        Some(h) => h,
        None => return results,
    };

    let config_path = home.join(".ssh").join("config");
    let content = match std::fs::read_to_string(&config_path) {
        Ok(c) => c,
        Err(_) => return results,
    };

    parse_config_content(&content, &mut results);
    results
}

fn parse_config_content(content: &str, results: &mut Vec<SshHost>) {
    let mut current_names: Vec<String> = Vec::new();
    let mut hostname: Option<String> = None;
    let mut user: Option<String> = None;
    let mut port: Option<u16> = None;

    for line in content.lines() {
        let line = line.trim();

        // Skip comments and empty lines
        if line.is_empty() || line.starts_with('#') {
            continue;
        }

        // Split on first whitespace or '='
        let (key, value) = match split_config_line(line) {
            Some(kv) => kv,
            None => continue,
        };

        let key_lower = key.to_lowercase();

        if key_lower == "host" {
            // Flush previous host entry
            flush_hosts(&current_names, &hostname, &user, &port, results);

            // Start new host(s) — Host directive can list multiple patterns
            current_names = value
                .split_whitespace()
                .filter(|s| !s.contains('*') && !s.contains('?'))
                .map(String::from)
                .collect();
            hostname = None;
            user = None;
            port = None;
        } else if key_lower == "match" {
            // Flush and reset — Match blocks are complex, skip them
            flush_hosts(&current_names, &hostname, &user, &port, results);
            current_names.clear();
            hostname = None;
            user = None;
            port = None;
        } else if !current_names.is_empty() {
            match key_lower.as_str() {
                "hostname" => hostname = Some(value.to_string()),
                "user" => user = Some(value.to_string()),
                "port" => port = value.parse().ok(),
                _ => {}
            }
        }
    }

    // Flush last entry
    flush_hosts(&current_names, &hostname, &user, &port, results);
}

fn flush_hosts(
    names: &[String],
    hostname: &Option<String>,
    user: &Option<String>,
    port: &Option<u16>,
    results: &mut Vec<SshHost>,
) {
    for name in names {
        results.push(SshHost {
            name: name.clone(),
            hostname: hostname.as_deref().unwrap_or(name).to_string(),
            user: user.clone(),
            port: *port,
        });
    }
}

/// Split a config line into (key, value).
/// Handles both "Key Value" and "Key=Value" formats.
fn split_config_line(line: &str) -> Option<(&str, &str)> {
    // Try '=' separator first
    if let Some(eq_pos) = line.find('=') {
        let key = line[..eq_pos].trim();
        let value = line[eq_pos + 1..].trim();
        if !key.is_empty() && !value.is_empty() {
            return Some((key, value));
        }
    }

    // Fall back to whitespace separator
    let mut parts = line.splitn(2, char::is_whitespace);
    let key = parts.next()?.trim();
    let value = parts.next()?.trim();
    if key.is_empty() || value.is_empty() {
        return None;
    }
    Some((key, value))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_basic_config() {
        let config = r#"
Host myserver
    HostName 192.168.1.100
    User admin
    Port 2222

Host devbox
    HostName dev.example.com
    User developer
"#;
        let mut results = Vec::new();
        parse_config_content(config, &mut results);

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].name, "myserver");
        assert_eq!(results[0].hostname, "192.168.1.100");
        assert_eq!(results[0].user.as_deref(), Some("admin"));
        assert_eq!(results[0].port, Some(2222));
        assert_eq!(results[1].name, "devbox");
        assert_eq!(results[1].hostname, "dev.example.com");
        assert_eq!(results[1].user.as_deref(), Some("developer"));
        assert_eq!(results[1].port, None);
    }

    #[test]
    fn skips_wildcard_hosts() {
        let config = r#"
Host *
    ServerAliveInterval 60

Host production
    HostName prod.example.com
"#;
        let mut results = Vec::new();
        parse_config_content(config, &mut results);

        assert_eq!(results.len(), 1);
        assert_eq!(results[0].name, "production");
    }

    #[test]
    fn handles_multi_host_line() {
        let config = "Host server1 server2\n    User root\n";
        let mut results = Vec::new();
        parse_config_content(config, &mut results);

        assert_eq!(results.len(), 2);
        assert_eq!(results[0].name, "server1");
        assert_eq!(results[1].name, "server2");
    }

    #[test]
    fn hostname_defaults_to_name() {
        let config = "Host shortname\n    User me\n";
        let mut results = Vec::new();
        parse_config_content(config, &mut results);

        assert_eq!(results[0].hostname, "shortname");
    }
}
