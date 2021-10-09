{
  inputs.nixpkgs.url = github:nixos/nixpkgs;
  inputs.flake-utils.url = github:numtide/flake-utils;
  inputs.flake-compat.url = github:edolstra/flake-compat;
  inputs.flake-compat.flake = false;

  outputs = { self, nixpkgs, flake-utils, flake-compat }:
    flake-utils.lib.simpleFlake {
      inherit self nixpkgs;
      name = "nix-copy-action";
      shell = { pkgs }: pkgs.mkShell {
        name = "nix-copy-action";
        nativeBuildInputs = with pkgs; [
          nodejs
        ];
      };
    };
}
