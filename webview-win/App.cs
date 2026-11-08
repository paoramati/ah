// ah's native window on Windows (#27): a WebView2 shell for ah's pages.
//
//   ah-app.exe --url <url> [--title <name>] [--data <dir>] [--state <file>]
//              [--screenshot <png>]
//
// - One window per URL: a second launch for the same URL brings the first
//   forward and exits (a named mutex and event from a hash of the URL).
// - Its own taskbar identity ("Paoramati.Ah") and icon, drawn here.
// - The title follows the page's. Size and position are remembered.
// - Links off the local server open in the default browser.
// - --screenshot loads the page, writes a PNG of its content and exits.
//
// Compiled by webview-win/build.ps1 with the C# 5 compiler that ships with
// Windows, so no newer syntax: no ?., no string interpolation, no nameof.

using System;
using System.Diagnostics;
using System.Drawing;
using System.Drawing.Drawing2D;
using System.Drawing.Text;
using System.IO;
using System.Runtime.InteropServices;
using System.Security.Cryptography;
using System.Text;
using System.Threading;
using System.Windows.Forms;
using Microsoft.Web.WebView2.Core;
using Microsoft.Web.WebView2.WinForms;

static class Program
{
    [DllImport("shell32.dll")]
    static extern int SetCurrentProcessExplicitAppUserModelID(
        [MarshalAs(UnmanagedType.LPWStr)] string id);

    [DllImport("user32.dll")]
    static extern bool AllowSetForegroundWindow(int pid);

    public const string AppId = "Paoramati.Ah";

    /// <summary>--name value, or null.</summary>
    static string Arg(string[] args, string name)
    {
        for (int i = 0; i < args.Length - 1; i++)
            if (args[i] == name) return args[i + 1];
        return null;
    }

    /// <summary>A short stable key for a URL, for the mutex and event names.</summary>
    public static string KeyOf(string url)
    {
        using (var sha = SHA1.Create())
        {
            byte[] hash = sha.ComputeHash(Encoding.UTF8.GetBytes(url));
            var sb = new StringBuilder();
            for (int i = 0; i < 8; i++) sb.Append(hash[i].ToString("x2"));
            return sb.ToString();
        }
    }

    /// <summary>Whether a URL is ah's own server (or an internal page), which stays in the window.</summary>
    public static bool IsLocal(string url)
    {
        Uri u;
        if (!Uri.TryCreate(url, UriKind.Absolute, out u)) return false;
        if (u.Scheme == "about" || u.Scheme == "data" || u.Scheme == "blob") return true;
        return u.Host == "127.0.0.1" || u.Host == "localhost";
    }

    [STAThread]
    static int Main(string[] args)
    {
        string url = Arg(args, "--url");
        if (string.IsNullOrEmpty(url))
        {
            Console.Error.WriteLine("usage: ah-app --url <url> [--title <name>] [--screenshot <png>]");
            return 64;
        }
        string title = Arg(args, "--title") ?? "ah";
        string shot = Arg(args, "--screenshot");
        string localApp = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        string data = Arg(args, "--data") ?? Path.Combine(localApp, "ah-app", "webview");
        string state = Arg(args, "--state") ?? Path.Combine(localApp, "ah-app", "window-state.txt");

        SetCurrentProcessExplicitAppUserModelID(AppId);

        string key = KeyOf(url);
        bool owner = true;
        Mutex mutex = null;
        if (shot == null)
        {
            mutex = new Mutex(true, "Local\\ah-app-" + key, out owner);
            if (!owner)
            {
                // The window is already open: bring it forward and leave
                AllowSetForegroundWindow(-1);
                try
                {
                    EventWaitHandle front = EventWaitHandle.OpenExisting("Local\\ah-app-front-" + key);
                    front.Set();
                }
                catch (WaitHandleCannotBeOpenedException) { }
                return 0;
            }
        }

        Application.EnableVisualStyles();
        Application.SetCompatibleTextRenderingDefault(false);
        var form = new AppForm(url, title, data, state, shot, key);
        Application.Run(form);
        if (mutex != null) mutex.ReleaseMutex();
        return form.ExitCode;
    }
}

class AppForm : Form
{
    readonly string url, dataDir, stateFile, shotFile, key;
    readonly WebView2 view = new WebView2();
    public int ExitCode;

    public AppForm(string url, string title, string dataDir, string stateFile, string shotFile, string key)
    {
        this.url = url;
        this.dataDir = dataDir;
        this.stateFile = stateFile;
        this.shotFile = shotFile;
        this.key = key;
        Text = title;
        Icon = MakeIcon();
        StartPosition = FormStartPosition.CenterScreen;
        Size = new Size(1000, 720);
        view.Dock = DockStyle.Fill;
        Controls.Add(view);
        if (shotFile == null) LoadBounds();
        else
        {
            // A fixed size, so screenshots compare
            Size = new Size(1000, 720);
            ShowInTaskbar = false;
        }
        Shown += async (s, e) => await Start();
        FormClosing += (s, e) => SaveBounds();
        if (shotFile == null) ListenForFront();
    }

    /// <summary>The teal circle with an "a", as the tray icon draws it.</summary>
    static Icon MakeIcon()
    {
        using (var bmp = new Bitmap(32, 32))
        using (var g = Graphics.FromImage(bmp))
        {
            g.SmoothingMode = SmoothingMode.AntiAlias;
            g.TextRenderingHint = TextRenderingHint.AntiAliasGridFit;
            using (var brush = new SolidBrush(Color.FromArgb(13, 148, 136)))
                g.FillEllipse(brush, 1, 1, 30, 30);
            using (var font = new Font("Segoe UI", 22, FontStyle.Bold, GraphicsUnit.Pixel))
                g.DrawString("a", font, Brushes.White, 6, 0);
            return Icon.FromHandle(bmp.GetHicon());
        }
    }

    // ---- taskbar identity, on the window as well as the process ----

    [ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"),
     InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IPropertyStore
    {
        void GetCount(out uint count);
        void GetAt(uint index, out PropKey key);
        void GetValue(ref PropKey key, out PropVariant value);
        void SetValue(ref PropKey key, ref PropVariant value);
        void Commit();
    }

    [StructLayout(LayoutKind.Sequential, Pack = 4)]
    struct PropKey { public Guid FormatId; public uint PropertyId; }

    [StructLayout(LayoutKind.Explicit, Size = 24)]
    struct PropVariant
    {
        [FieldOffset(0)] public ushort Type;
        [FieldOffset(8)] public IntPtr Pointer;
    }

    [DllImport("shell32.dll")]
    static extern int SHGetPropertyStoreForWindow(IntPtr hwnd, ref Guid riid,
        [MarshalAs(UnmanagedType.Interface)] out IPropertyStore store);

    /// <summary>The same AppUserModelID as the process, on the window itself, so the taskbar groups every ah window under one button.</summary>
    void SetWindowAppId()
    {
        try
        {
            Guid iid = new Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99");
            IPropertyStore store;
            int hr = SHGetPropertyStoreForWindow(Handle, ref iid, out store);
            if (hr != 0) { Console.Error.WriteLine("ah-app: no property store for the window: 0x" + hr.ToString("x")); return; }
            var key = new PropKey();
            key.FormatId = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3");
            key.PropertyId = 5; // System.AppUserModel.ID
            var value = new PropVariant();
            value.Type = 31; // VT_LPWSTR
            value.Pointer = Marshal.StringToCoTaskMemUni(Program.AppId);
            store.SetValue(ref key, ref value);
            store.Commit();
            Marshal.FreeCoTaskMem(value.Pointer);
        }
        catch (Exception ex) { Console.Error.WriteLine("ah-app: setting the window id failed: " + ex.Message); }
    }

    protected override void OnHandleCreated(EventArgs e)
    {
        base.OnHandleCreated(e);
        SetWindowAppId();
    }

    // ---- size and position ----

    void LoadBounds()
    {
        try
        {
            if (!File.Exists(stateFile)) return;
            string[] p = File.ReadAllText(stateFile).Trim().Split(' ');
            if (p.Length < 4) return;
            var r = new Rectangle(int.Parse(p[0]), int.Parse(p[1]), int.Parse(p[2]), int.Parse(p[3]));
            if (r.Width < 300 || r.Height < 200) return;
            // Only where some screen shows it, so an unplugged monitor can't hide the window
            foreach (Screen s in Screen.AllScreens)
            {
                Rectangle overlap = Rectangle.Intersect(s.WorkingArea, r);
                if (overlap.Width >= 100 && overlap.Height >= 50)
                {
                    StartPosition = FormStartPosition.Manual;
                    Bounds = r;
                    return;
                }
            }
        }
        catch (Exception) { }
    }

    void SaveBounds()
    {
        if (shotFile != null) return;
        try
        {
            Rectangle r = WindowState == FormWindowState.Normal ? Bounds : base.RestoreBounds;
            Directory.CreateDirectory(Path.GetDirectoryName(stateFile));
            File.WriteAllText(stateFile, r.X + " " + r.Y + " " + r.Width + " " + r.Height);
        }
        catch (Exception) { }
    }

    // ---- a second launch for the same URL brings this window forward ----

    void ListenForFront()
    {
        var front = new EventWaitHandle(false, EventResetMode.AutoReset, "Local\\ah-app-front-" + key);
        var t = new Thread(() =>
        {
            while (true)
            {
                front.WaitOne();
                try { BeginInvoke(new Action(Bring)); } catch (Exception) { return; }
            }
        });
        t.IsBackground = true;
        t.Start();
    }

    [DllImport("user32.dll")]
    static extern bool SetForegroundWindow(IntPtr h);

    void Bring()
    {
        if (WindowState == FormWindowState.Minimized) WindowState = FormWindowState.Normal;
        Activate();
        SetForegroundWindow(Handle);
    }

    // ---- the page ----

    async System.Threading.Tasks.Task Start()
    {
        try
        {
            var env = await CoreWebView2Environment.CreateAsync(null, dataDir);
            await view.EnsureCoreWebView2Async(env);
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("ah-app: WebView2 isn't available: " + e.Message);
            if (shotFile == null)
                MessageBox.Show("ah's window needs the WebView2 runtime, which couldn't start:\n\n" + e.Message,
                    "ah", MessageBoxButtons.OK, MessageBoxIcon.Warning);
            ExitCode = 3;
            Close();
            return;
        }
        CoreWebView2 core = view.CoreWebView2;
        core.Settings.AreDefaultContextMenusEnabled = true;
        core.Settings.IsStatusBarEnabled = false;
        core.DocumentTitleChanged += (s, e) =>
        {
            string t = core.DocumentTitle;
            if (!string.IsNullOrEmpty(t) && shotFile == null) Text = t;
        };
        // Links to other sites open in the browser, not in this window
        core.NavigationStarting += (s, e) =>
        {
            if (!Program.IsLocal(e.Uri))
            {
                e.Cancel = true;
                OpenExternal(e.Uri);
            }
        };
        core.NewWindowRequested += (s, e) =>
        {
            e.Handled = true;
            if (Program.IsLocal(e.Uri)) core.Navigate(e.Uri);
            else OpenExternal(e.Uri);
        };
        if (shotFile != null) core.NavigationCompleted += async (s, e) => await Screenshot(core, e.IsSuccess);
        core.Navigate(url);
    }

    static void OpenExternal(string uri)
    {
        Uri u;
        if (!Uri.TryCreate(uri, UriKind.Absolute, out u)) return;
        if (u.Scheme != "http" && u.Scheme != "https") return;
        try { Process.Start(new ProcessStartInfo(u.AbsoluteUri) { UseShellExecute = true }); }
        catch (Exception) { }
    }

    async System.Threading.Tasks.Task Screenshot(CoreWebView2 core, bool loaded)
    {
        if (!loaded) { Console.Error.WriteLine("ah-app: the page did not load: " + url); ExitCode = 2; Close(); return; }
        // The page's scripts draw after the load event
        await System.Threading.Tasks.Task.Delay(1800);
        try
        {
            using (var fs = new FileStream(shotFile, FileMode.Create))
                await core.CapturePreviewAsync(CoreWebView2CapturePreviewImageFormat.Png, fs);
        }
        catch (Exception e)
        {
            Console.Error.WriteLine("ah-app: screenshot failed: " + e.Message);
            ExitCode = 2;
        }
        Close();
    }
}
