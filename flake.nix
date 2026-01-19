{
  description = "WebOS TV Development Environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-23.05";
    nixpkgs-latest.url = "github:NixOS/nixpkgs/nixos-unstable";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { self, nixpkgs, nixpkgs-latest, flake-utils }:
    flake-utils.lib.eachDefaultSystem (system:
      let
        pkgs = import nixpkgs {
          inherit system;
          config.permittedInsecurePackages = [
            "nodejs-16.20.2"
          ];
        };

        pkgs-latest = nixpkgs-latest.legacyPackages.${system};
        nodejs16 = pkgs.nodejs_16;
        nodejsLatest = pkgs-latest.nodejs;

      in {
        devShells.default = pkgs.mkShell {
          buildInputs = [
            nodejsLatest
          ];

          shellHook = ''
          echo "WebOS Development Environment"
          echo "Node (default): $(node --version)"
          echo "Node 16 available via: node16"

          # Add Node 16 binaries to a local bin directory
          mkdir -p .nix-bin
          ln -sf ${nodejs16}/bin/node .nix-bin/node16
          ln -sf ${nodejs16}/bin/npm .nix-bin/npm16

          # Set up a local npm prefix to avoid global installs
          export NPM_CONFIG_PREFIX=$PWD/.npm-global
          export PATH=$PWD/.npm-global/bin:$PATH

          # Install WebOS CLI tools locally if not already installed
          if [ ! -f .npm-global/bin/ares ]; then
            echo "Installing WebOS CLI tools..."
            npm install -g @webos-tools/cli
          fi

          # For Enact CLI
          if [ ! -f .npm-global/bin/enact ]; then
            echo "Installing Enact CLI..."
            npm install -g @enact/cli
          fi

          # Create wrappers for WebOS tools that use Node 16
          for cmd in ares-setup-device ares-install ares-launch ares-device-info ares-server; do
            if [ -f .npm-global/bin/$cmd ]; then
              cat > .nix-bin/$cmd << WRAPPER_EOF
#!/bin/bash
exec ${nodejs16}/bin/node $PWD/.npm-global/bin/$cmd "\$@"
WRAPPER_EOF
              chmod +x .nix-bin/$cmd
            fi
          done

          # Add .nix-bin to PATH AFTER creating wrappers and BEFORE .npm-global
          export PATH=$PWD/.nix-bin:$PWD/.npm-global/bin:$PATH

          # Function to start WebOS development server
          server() {
            ares-server
          }

          # Function to launch WebOS Simulator
          simulator() {
            # Start server in background if not already running
            if ! pgrep -f "ares-server" > /dev/null; then
              echo "Starting WebOS development server..."
              ares-server &
              sleep 2
            fi
            open /Applications/WebOS.app
          }

          # Function to stop the server
          stop-server() {
            pkill -f "ares-server"
            echo "WebOS server stopped"
          }

          echo ""
          echo "Ready for WebOS development!"
          echo "Commands:"
          echo "  node / npm     → Latest Node (v$(node --version | sed 's/v//'))"
          echo "  node16 / npm16 → Node 16 (v$(${nodejs16}/bin/node --version | sed 's/v//'))"
          echo "  ares-* commands will automatically use Node 16 (except ares-package)"
          echo "  simulator      → Launch WebOS TV Simulator"
          echo "  server         → Start WebOS development server"
          echo "  stop-server    → Stop WebOS development server"
        '';
        };
      }
    );
}