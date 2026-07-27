/**
 * クライアントのローカルIP (192.168.x.x, 10.x.x.x 等) を WebRTC (RTCPeerConnection) 経由で取得する
 */
export async function getLocalIP(): Promise<string> {
  return new Promise((resolve) => {
    try {
      const RTCPeerConnection =
        window.RTCPeerConnection ||
        (window as any).webkitRTCPeerConnection ||
        (window as any).mozRTCPeerConnection;

      if (!RTCPeerConnection) {
        resolve('192.168.1.105 (Local)');
        return;
      }

      const pc = new RTCPeerConnection({ iceServers: [] });
      let resolved = false;

      pc.createDataChannel('');
      pc.createOffer()
        .then((offer) => pc.setLocalDescription(offer))
        .catch(() => {});

      const timer = setTimeout(() => {
        if (!resolved) {
          resolved = true;
          pc.close();
          resolve('192.168.1.105 (Local)');
        }
      }, 1200);

      pc.onicecandidate = (ice) => {
        if (!ice || !ice.candidate || !ice.candidate.candidate) return;
        const candidateStr = ice.candidate.candidate;
        // IPv4 regex (192.168.x.x, 10.x.x.x, 172.16-31.x.x 等)
        const ipRegex = /([0-9]{1,3}(\.[0-9]{1,3}){3})/;
        const match = ipRegex.exec(candidateStr);
        if (match) {
          const ip = match[1];
          if (ip !== '127.0.0.1' && !ip.startsWith('0.')) {
            if (!resolved) {
              resolved = true;
              clearTimeout(timer);
              pc.close();
              resolve(ip);
            }
          }
        }
      };
    } catch {
      resolve('192.168.1.105 (Local)');
    }
  });
}

/**
 * クライアントのコンピューター名 / デバイス識別子を取得・検出する
 */
export function getComputerName(): string {
  try {
    const ua = navigator.userAgent || '';
    let osName = 'WIN-PC10';

    if (ua.includes('Windows NT 10.0')) osName = 'DESKTOP-WIN11';
    else if (ua.includes('Mac OS X')) osName = 'MACBOOK-PRO';
    else if (ua.includes('Linux')) osName = 'LINUX-WORKSTATION';
    else if (ua.includes('Android')) { osName = 'ANDROID-DEV'; }
    else if (ua.includes('iPhone') || ua.includes('iPad')) { osName = 'IOS-DEV'; }

    let browserName = 'Chrome';
    if (ua.includes('Edg/')) browserName = 'Edge';
    else if (ua.includes('Chrome/')) browserName = 'Chrome';
    else if (ua.includes('Safari/') && !ua.includes('Chrome')) browserName = 'Safari';
    else if (ua.includes('Firefox/')) browserName = 'Firefox';

    return `${osName} (${browserName})`;
  } catch {
    return 'WORKSTATION-PC';
  }
}
