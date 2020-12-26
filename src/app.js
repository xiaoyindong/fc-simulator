const fs = require('fs');
// const path = require('path');
const jsnes = require('jsnes');
// var vConsole = new VConsole();

class Simulator {
    uninstall = false;
    canvas = document.getElementById('main_screen');
    SCREEN_WIDTH = 256;
    SCREEN_HEIGHT = 240;
    FRAMEBUFFER_SIZE = this.SCREEN_WIDTH * this.SCREEN_HEIGHT;
    canvas_ctx;
    image;
    framebuffer_u8;
    framebuffer_u32;
    AUDIO_BUFFERING = 512;
    SAMPLE_COUNT = 4 * 1024;
    audio_write_cursor = 0;
    audio_read_cursor = 0;
    constructor(path) {
        this.path = path;
        this.SAMPLE_MASK = this.SAMPLE_COUNT - 1;
        this.audio_samples_L = new Float32Array(this.SAMPLE_COUNT);
        this.audio_samples_R = new Float32Array(this.SAMPLE_COUNT);
        this.resize();
        this.nes = this.getnes();
        this.bindKey();
        this.nes_init();
        this.load_game();
    }

    getnes() {
        return new jsnes.NES({
            onFrame: (framebuffer_24) => {
                for (var i = 0; i < this.FRAMEBUFFER_SIZE; i++) {
                    this.framebuffer_u32[i] = 0xFF000000 | framebuffer_24[i];
                }
            },
            onAudioSample: (l, r) => {
                this.audio_samples_L[this.audio_write_cursor] = l;
                this.audio_samples_R[this.audio_write_cursor] = r;
                this.audio_write_cursor = (this.audio_write_cursor + 1) & this.SAMPLE_MASK;
            },
        });

    }

    bindKey() {
        function keyboard(callback, player = 1, keyCode) {
            switch (keyCode) {
                case 87: // UP
                    callback(player, jsnes.Controller.BUTTON_UP); break;
                case 83: // Down
                    callback(player, jsnes.Controller.BUTTON_DOWN); break;
                case 65: // Left
                    callback(player, jsnes.Controller.BUTTON_LEFT); break;
                case 68: // Right
                    callback(player, jsnes.Controller.BUTTON_RIGHT); break;
                case 74: // 'a' - qwerty, dvorak
                    callback(player, jsnes.Controller.BUTTON_B); break;
                case 75: // 'q' - azerty
                    callback(player, jsnes.Controller.BUTTON_A); break;
                case 85: // 's' - qwerty, azerty
                    callback(player, jsnes.Controller.BUTTON_B); break;
                case 73: // 'o' - dvorak
                    callback(player, jsnes.Controller.BUTTON_A); break;
                case 16: // Tab
                    callback(player, jsnes.Controller.BUTTON_SELECT); break;
                case 13: // Return
                    callback(player, jsnes.Controller.BUTTON_START); break;
                default: break;
            }
        }
        document.onkeydown = (event) => { keyboard(this.nes.buttonDown, 1, event.keyCode) };
        document.onkeyup = (event) => { keyboard(this.nes.buttonUp, 1, event.keyCode) };
    }

    resize() {
        const resize = () => {
            this.canvas.width = this.SCREEN_WIDTH;
            this.canvas.height = this.SCREEN_HEIGHT;
            this.canvas.style.width = window.innerWidth + 'px';
            this.canvas.style.height = window.innerHeight + 'px';
        }
        window.onresize = resize();
    }

    onAnimationFrame() { // 加载画面
        window.requestAnimationFrame(this.onAnimationFrame.bind(this));
        this.image.data.set(this.framebuffer_u8);
        this.canvas_ctx.putImageData(this.image, 0, 0);
    }

    load_game() {
        var romData = fs.readFileSync(this.path, { encoding: 'binary' });
        this.nes.loadROM(romData);
        window.requestAnimationFrame(this.onAnimationFrame.bind(this));
    }

    nes_init() {

        this.canvas_ctx = this.canvas.getContext("2d");
        this.image = this.canvas_ctx.getImageData(0, 0, this.SCREEN_WIDTH, this.SCREEN_HEIGHT);

        this.canvas_ctx.fillStyle = "black";
        this.canvas_ctx.fillRect(0, 0, this.SCREEN_WIDTH, this.SCREEN_HEIGHT);

        // Allocate framebuffer array.
        var buffer = new ArrayBuffer(this.image.data.length);
        this.framebuffer_u8 = new Uint8ClampedArray(buffer);
        this.framebuffer_u32 = new Uint32Array(buffer);

        // Setup audio.
        this.audio_ctx = new window.AudioContext();
        var script_processor = this.audio_ctx.createScriptProcessor(this.AUDIO_BUFFERING, 0, 2);
        script_processor.onaudioprocess = this.audio_callback.bind(this);
        script_processor.connect(this.audio_ctx.destination);
    }

    audio_callback(event) {
        if (this.uninstall) {
            this.audio_ctx.close();
            return;
        }
        var dst = event.outputBuffer;
        var len = dst.length;

        // Attempt to avoid buffer underruns.
        if (this.audio_remain() < this.AUDIO_BUFFERING) {
            this.nes.frame();
        }

        var dst_l = dst.getChannelData(0);
        var dst_r = dst.getChannelData(1);
        for (var i = 0; i < len; i++) {
            var src_idx = (this.audio_read_cursor + i) & this.SAMPLE_MASK;
            dst_l[i] = this.audio_samples_L[src_idx];
            dst_r[i] = this.audio_samples_R[src_idx];
        }
        this.audio_read_cursor = (this.audio_read_cursor + len) & this.SAMPLE_MASK;
    }

    audio_remain() {
        return (this.audio_write_cursor - this.audio_read_cursor) & this.SAMPLE_MASK;
    }

    stop() {
        this.uninstall = true;
    }
}

let game = null;

document.addEventListener('drop', (event) => {
    if (event.dataTransfer.files && event.dataTransfer.files[0]) {
        var path = event.dataTransfer.files[0].path;
        game && game.stop();
        game = new Simulator(path);
    }
    event.stopPropagation();
    event.preventDefault();
    return false
})

document.addEventListener('dragover', (event) => {
    event.stopPropagation();
    event.preventDefault();
    return false
})