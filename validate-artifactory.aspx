<%@ Page Language="C#" %>
<%@ Import Namespace="System" %>
<%@ Import Namespace="System.Collections.Generic" %>
<%@ Import Namespace="System.Diagnostics" %>
<%@ Import Namespace="System.IO" %>
<%@ Import Namespace="System.Net" %>
<%@ Import Namespace="System.Security.Cryptography" %>
<%@ Import Namespace="System.Text" %>
<%@ Import Namespace="System.Text.RegularExpressions" %>
<%@ Import Namespace="System.Web.Script.Serialization" %>

<script runat="server">
    public class ValidationRequest
    {
        public string flowName { get; set; }
        public string change { get; set; }
        public List<PackageRequest> packages { get; set; }
    }

    public class PackageRequest
    {
        public string nodeName { get; set; }
        public string buildType { get; set; }
        public string folder { get; set; }
        public string package { get; set; }
    }

    public class ArtifactoryConfig
    {
        public string authMode { get; set; }
        public string baseUrl { get; set; }
        public string username { get; set; }
        public string password { get; set; }
        public string passwordEncrypted { get; set; }
        public string passwordEncryptionScope { get; set; }
        public string keePassScriptPath { get; set; }
        public string keePassCredentialTitle { get; set; }
        public string keePassUsernameOverride { get; set; }
    }

    public class ResolvedCredentials
    {
        public string Username { get; set; }
        public string Password { get; set; }
    }

    public class KeePassCredentialResult
    {
        public string username { get; set; }
        public string password { get; set; }
        public string error { get; set; }
    }

    private readonly JavaScriptSerializer _serializer = new JavaScriptSerializer { MaxJsonLength = int.MaxValue };

    protected void Page_Load(object sender, EventArgs e)
    {
        Response.ContentType = "application/json";
        Response.Cache.SetCacheability(HttpCacheability.NoCache);

        if (!string.Equals(Request.HttpMethod, "POST", StringComparison.OrdinalIgnoreCase))
        {
            WriteJson(new
            {
                ok = false,
                error = "Uzyj metody POST."
            }, 405);
            return;
        }

        try
        {
            var payload = ReadPayload();
            if (payload == null || payload.packages == null || payload.packages.Count == 0)
            {
                WriteJson(new
                {
                    ok = false,
                    error = "Brak paczek do sprawdzenia."
                }, 400);
                return;
            }

            var config = LoadConfig();
            var credentials = ResolveCredentials(config);
            if (string.IsNullOrWhiteSpace(config.baseUrl) || string.IsNullOrWhiteSpace(credentials.Username) || string.IsNullOrWhiteSpace(credentials.Password))
            {
                WriteJson(new
                {
                    ok = false,
                    error = "Brak konfiguracji Artifactory. Uzupełnij App_Data/artifactory.config.json."
                }, 500);
                return;
            }

            ServicePointManager.SecurityProtocol = SecurityProtocolType.Tls12;
            ServicePointManager.ServerCertificateValidationCallback = delegate { return true; };

            var folderCache = new Dictionary<string, string>(StringComparer.OrdinalIgnoreCase);
            var found = new List<object>();
            var missing = new List<object>();
            var skipped = new List<object>();

            foreach (var item in payload.packages)
            {
                if (item == null || string.IsNullOrWhiteSpace(item.folder) || string.IsNullOrWhiteSpace(item.package))
                {
                    skipped.Add(new
                    {
                        nodeName = item != null ? item.nodeName : "",
                        buildType = item != null ? item.buildType : "",
                        reason = "Niepelne dane walidacji."
                    });
                    continue;
                }

                var folderUrl = CombineUrl(config.baseUrl, item.folder + "/");
                string html;
                if (!folderCache.TryGetValue(folderUrl, out html))
                {
                    html = DownloadFolderHtml(folderUrl, credentials.Username, credentials.Password);
                    folderCache[folderUrl] = html;
                }

                var record = new
                {
                    nodeName = item.nodeName ?? "",
                    buildType = item.buildType ?? "",
                    folder = item.folder ?? "",
                    package = item.package ?? ""
                };

                if (PackageExistsInHtml(html, item.package))
                {
                    found.Add(record);
                }
                else
                {
                    missing.Add(record);
                }
            }

            WriteJson(new
            {
                ok = missing.Count == 0,
                found = found,
                missing = missing,
                skipped = skipped
            });
        }
        catch (WebException ex)
        {
            WriteJson(new
            {
                ok = false,
                error = "Blad polaczenia z Artifactory: " + ReadWebException(ex),
                found = new object[0],
                missing = new object[0],
                skipped = new object[0]
            }, 502);
        }
        catch (Exception ex)
        {
            WriteJson(new
            {
                ok = false,
                error = ex.Message,
                found = new object[0],
                missing = new object[0],
                skipped = new object[0]
            }, 500);
        }
    }

    private ValidationRequest ReadPayload()
    {
        Request.InputStream.Position = 0;
        using (var reader = new StreamReader(Request.InputStream, Encoding.UTF8))
        {
            var body = reader.ReadToEnd();
            return string.IsNullOrWhiteSpace(body) ? null : _serializer.Deserialize<ValidationRequest>(body);
        }
    }

    private ArtifactoryConfig LoadConfig()
    {
        var path = Server.MapPath("~/App_Data/artifactory.config.json");
        if (!File.Exists(path))
        {
            return new ArtifactoryConfig();
        }

        var json = File.ReadAllText(path, Encoding.UTF8);
        return string.IsNullOrWhiteSpace(json)
            ? new ArtifactoryConfig()
            : _serializer.Deserialize<ArtifactoryConfig>(json);
    }

    private ResolvedCredentials ResolveCredentials(ArtifactoryConfig config)
    {
        if (config == null)
        {
            return new ResolvedCredentials();
        }

        if (ShouldUseKeePass(config))
        {
            return ResolveKeePassCredentials(config);
        }

        return new ResolvedCredentials
        {
            Username = config.username ?? "",
            Password = ResolvePassword(config)
        };
    }

    private bool ShouldUseKeePass(ArtifactoryConfig config)
    {
        if (config == null)
        {
            return false;
        }

        var authMode = (config.authMode ?? "").Trim();
        if (string.Equals(authMode, "KeePassVault", StringComparison.OrdinalIgnoreCase))
        {
            return true;
        }

        if (string.Equals(authMode, "PlainText", StringComparison.OrdinalIgnoreCase) ||
            string.Equals(authMode, "EncryptedPassword", StringComparison.OrdinalIgnoreCase))
        {
            return false;
        }

        return string.IsNullOrWhiteSpace(config.password) && string.IsNullOrWhiteSpace(config.passwordEncrypted);
    }

    private string ResolvePassword(ArtifactoryConfig config)
    {
        if (config == null)
        {
            return "";
        }

        if (!string.IsNullOrWhiteSpace(config.passwordEncrypted))
        {
            var scope = string.Equals(config.passwordEncryptionScope, "LocalMachine", StringComparison.OrdinalIgnoreCase)
                ? DataProtectionScope.LocalMachine
                : DataProtectionScope.CurrentUser;
            var protectedBytes = Convert.FromBase64String(config.passwordEncrypted);
            var plainBytes = ProtectedData.Unprotect(protectedBytes, null, scope);
            return Encoding.UTF8.GetString(plainBytes);
        }

        return config.password ?? "";
    }

    private ResolvedCredentials ResolveKeePassCredentials(ArtifactoryConfig config)
    {
        var scriptPath = GetKeePassResolverScriptPath();
        var credentialTitle = !string.IsNullOrWhiteSpace(config.keePassCredentialTitle)
            ? config.keePassCredentialTitle.Trim()
            : (config.username ?? "").Trim();

        if (!File.Exists(scriptPath))
        {
            throw new Exception("Nie znaleziono skryptu KeePass resolver: " + scriptPath);
        }

        if (string.IsNullOrWhiteSpace(credentialTitle))
        {
            throw new Exception("Brak nazwy uzytkownika w konfiguracji Artifactory.");
        }

        var output = RunPowerShellFile(scriptPath, credentialTitle);
        var result = _serializer.Deserialize<KeePassCredentialResult>(output);
        if (result == null)
        {
            throw new Exception("KeePass zwrocil pusty wynik.");
        }

        if (!string.IsNullOrWhiteSpace(result.error))
        {
            throw new Exception(result.error);
        }

        var username = string.IsNullOrWhiteSpace(config.keePassUsernameOverride)
            ? (!string.IsNullOrWhiteSpace(result.username) ? result.username : (config.username ?? ""))
            : config.keePassUsernameOverride;

        return new ResolvedCredentials
        {
            Username = username,
            Password = result.password ?? ""
        };
    }

    private string GetKeePassResolverScriptPath()
    {
        return Server.MapPath("~/Resolve-ArtifactoryKeePass.ps1");
    }

    private string RunPowerShellFile(string scriptPath, string credentialTitle)
    {
        var psi = new ProcessStartInfo
        {
            FileName = "powershell.exe",
            Arguments = "-NoProfile -ExecutionPolicy Bypass -File " + ToProcessArgument(scriptPath) + " -CredentialTitle " + ToProcessArgument(credentialTitle),
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };

        using (var process = Process.Start(psi))
        {
            var stdout = process.StandardOutput.ReadToEnd();
            var stderr = process.StandardError.ReadToEnd();
            process.WaitForExit();

            if (process.ExitCode != 0)
            {
                throw new Exception("Blad KeePassVault: " + (string.IsNullOrWhiteSpace(stderr) ? stdout : stderr));
            }

            if (string.IsNullOrWhiteSpace(stdout))
            {
                throw new Exception("KeePassVault nie zwrocil danych.");
            }

            return stdout.Trim();
        }
    }

    private string ToProcessArgument(string value)
    {
        return "\"" + (value ?? "").Replace("\"", "\\\"") + "\"";
    }

    private string DownloadFolderHtml(string url, string username, string password)
    {
        var request = (HttpWebRequest)WebRequest.Create(url);
        request.Method = "GET";
        request.PreAuthenticate = true;
        request.ContentType = "text/html";
        request.Headers[HttpRequestHeader.Authorization] = "Basic " + Convert.ToBase64String(Encoding.ASCII.GetBytes(username + ":" + password));

        using (var response = (HttpWebResponse)request.GetResponse())
        using (var stream = response.GetResponseStream())
        using (var reader = new StreamReader(stream))
        {
            return reader.ReadToEnd();
        }
    }

    private bool PackageExistsInHtml(string html, string packageName)
    {
        if (string.IsNullOrWhiteSpace(html) || string.IsNullOrWhiteSpace(packageName))
        {
            return false;
        }

        var escaped = Regex.Escape(packageName.Trim());
        var exactHrefPattern = escaped + "(?=[\"'<>\\s])";
        return Regex.IsMatch(html, exactHrefPattern, RegexOptions.IgnoreCase) ||
               html.IndexOf(packageName, StringComparison.OrdinalIgnoreCase) >= 0;
    }

    private string CombineUrl(string baseUrl, string relative)
    {
        var root = (baseUrl ?? "").TrimEnd('/') + "/";
        var child = (relative ?? "").TrimStart('/');
        return root + child;
    }

    private string ReadWebException(WebException ex)
    {
        if (ex == null)
        {
            return "Nieznany blad.";
        }

        if (ex.Response == null)
        {
            return ex.Message;
        }

        using (var stream = ex.Response.GetResponseStream())
        using (var reader = new StreamReader(stream))
        {
            var content = reader.ReadToEnd();
            return string.IsNullOrWhiteSpace(content) ? ex.Message : content;
        }
    }

    private void WriteJson(object data, int statusCode = 200)
    {
        Response.StatusCode = statusCode;
        Response.Write(_serializer.Serialize(data));
    }
</script>
