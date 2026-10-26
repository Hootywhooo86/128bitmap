package app.bitmaps128.map;

import android.os.Bundle;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(GuidancePlugin.class);
        super.onCreate(savedInstanceState);
    }
}
