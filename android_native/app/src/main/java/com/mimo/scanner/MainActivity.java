package com.mimo.scanner;

import android.Manifest;
import android.annotation.SuppressLint;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.ProgressBar;
import android.widget.Toast;

import androidx.activity.OnBackPressedCallback;
import androidx.annotation.NonNull;
import androidx.appcompat.app.AppCompatActivity;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout;

public class MainActivity extends AppCompatActivity {

    private static final int CAMERA_PERMISSION_CODE = 1001;
    private static final String APP_URL = "https://mimo-fidelidade.web.app/painel?mode=app&loja=casa-nuvem";

    private WebView webView;
    private SwipeRefreshLayout swipeRefresh;
    private ProgressBar progressBar;
    private PermissionRequest currentPermissionRequest;

    @SuppressLint("SetJavaScriptEnabled")
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        webView = findViewById(R.id.webView);
        swipeRefresh = findViewById(R.id.swipeRefresh);
        progressBar = findViewById(R.id.progressBar);

        setupBackPressHandler();
        setupWebView();
        setupSwipeRefresh();
        checkCameraPermission();

        webView.loadUrl(APP_URL);
    }

    private void setupBackPressHandler() {
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                if (webView != null && webView.canGoBack()) {
                    webView.goBack();
                } else {
                    finish();
                }
            }
        });
    }

    @SuppressLint("SetJavaScriptEnabled")
    private void setupWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setLoadWithOverviewMode(true);
        settings.setUseWideViewPort(true);
        settings.setSupportZoom(false);
        settings.setBuiltInZoomControls(false);

        // Custom User Agent identifier so the web app knows it is running in the native terminal
        String defaultUA = settings.getUserAgentString();
        settings.setUserAgentString(defaultUA + " MimoScannerApp/1.0.0 (Android Native Terminal)");

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                MainActivity.this.runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        currentPermissionRequest = request;
                        for (String res : request.getResources()) {
                            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(res)) {
                                if (ContextCompat.checkSelfPermission(MainActivity.this, Manifest.permission.CAMERA)
                                        == PackageManager.PERMISSION_GRANTED) {
                                    request.grant(request.getResources());
                                } else {
                                    ActivityCompat.requestPermissions(MainActivity.this,
                                            new String[]{Manifest.permission.CAMERA},
                                            CAMERA_PERMISSION_CODE);
                                }
                                return;
                            }
                        }
                        request.grant(request.getResources());
                    }
                });
            }

            @Override
            public void onProgressChanged(WebView view, int newProgress) {
                if (newProgress < 100) {
                    progressBar.setVisibility(View.VISIBLE);
                    progressBar.setProgress(newProgress);
                } else {
                    progressBar.setVisibility(View.GONE);
                }
            }
        });

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public void onPageStarted(WebView view, String url, Bitmap favicon) {
                super.onPageStarted(view, url, favicon);
            }

            @Override
            public void onPageFinished(WebView view, String url) {
                super.onPageFinished(view, url);
                swipeRefresh.setRefreshing(false);
                // Inject native flag
                view.evaluateJavascript("window.isNativeApp = true;", null);
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                String url = request.getUrl().toString();
                if (url.contains("mimo-fidelidade.web.app") || url.contains("mimo-fidelidade.firebaseapp.com")) {
                    return false; // let webview handle it
                }
                // External links (e.g. WhatsApp, Google Wallet pass addition, help links)
                try {
                    Intent intent = new Intent(Intent.ACTION_VIEW, Uri.parse(url));
                    startActivity(intent);
                    return true;
                } catch (Exception e) {
                    return false;
                }
            }
        });
    }

    private void setupSwipeRefresh() {
        swipeRefresh.setOnRefreshListener(new SwipeRefreshLayout.OnRefreshListener() {
            @Override
            public void onRefresh() {
                webView.reload();
            }
        });
        swipeRefresh.setColorSchemeResources(R.color.primary);
    }

    private void checkCameraPermission() {
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.CAMERA)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(this,
                    new String[]{Manifest.permission.CAMERA},
                    CAMERA_PERMISSION_CODE);
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions, @NonNull int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == CAMERA_PERMISSION_CODE) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                if (currentPermissionRequest != null) {
                    currentPermissionRequest.grant(currentPermissionRequest.getResources());
                    currentPermissionRequest = null;
                }
            } else {
                Toast.makeText(this, "A permissão de câmera é necessária para escanear os QR Codes dos clientes.", Toast.LENGTH_LONG).show();
                if (currentPermissionRequest != null) {
                    currentPermissionRequest.deny();
                    currentPermissionRequest = null;
                }
            }
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
        }
    }

    @Override
    protected void onPause() {
        if (webView != null) {
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (webView != null) {
            webView.destroy();
        }
        super.onDestroy();
    }
}
