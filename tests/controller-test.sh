#!/bin/sh
set -eu

binary=$1
test_root=${TMPDIR:-/tmp}/onekvm-zerotier-controller-$$
trap 'rm -rf "$test_root"' EXIT HUP INT TERM
mkdir -p "$test_root/config" "$test_root/data" "$test_root/sockets"
printf '%s\n' '{"network_id":"","moons_json":"[]","port":9993,"allow_managed":true,"allow_global":false,"allow_default":false,"allow_dns":false}' >"$test_root/config/config.json"

run_controller() {
    ONEKVM_EXTENSION_CONFIG="$test_root/config" \
    ONEKVM_EXTENSION_DATA="$test_root/data" \
    ONEKVM_EXTENSION_SOCKET="$test_root/sockets" \
        "$binary" --controller
}

enable_output=$(printf '%s' '{"event":"enable","extension_id":"zerotier","enabled":true}' | run_controller)
printf '%s' "$enable_output" | grep -q '"type":"ensure"'
printf '%s' "$enable_output" | grep -q '"type":"exec"'

disable_output=$(printf '%s' '{"event":"disable","extension_id":"zerotier","enabled":false}' | run_controller)
printf '%s' "$disable_output" | grep -q '"type":"remove_all"'

ONEKVM_EXTENSION_CONFIG="$test_root/config" "$binary" --health

# Removing a configured network must leave it in ZeroTier and delete it from
# the controller's managed list.  Copy the controller so its sibling CLI can
# be replaced by a deterministic test double.
mkdir -p "$test_root/bin" "$test_root/data/zerotier-one"
cp "$binary" "$test_root/bin/onekvm-zerotier-controller"
cat >"$test_root/bin/zerotier-cli" <<'EOF'
#!/bin/sh
printf '%s\n' "$*" >>"$ONEKVM_EXTENSION_DATA/cli.log"
case " $* " in
    *' info '*)
        attempts=0
        [ ! -f "$ONEKVM_EXTENSION_DATA/ready-attempts" ] || attempts=$(cat "$ONEKVM_EXTENSION_DATA/ready-attempts")
        attempts=$((attempts + 1))
        printf '%s\n' "$attempts" >"$ONEKVM_EXTENSION_DATA/ready-attempts"
        if [ "$attempts" -lt 3 ]; then
            echo '503 local control API is starting' >&2
            exit 1
        fi
        ;;
esac
exit 0
EOF
chmod +x "$test_root/bin/zerotier-cli"
touch "$test_root/data/zerotier-one/authtoken.secret"
printf '%s\n' '{"networks_json":"[\"8056c2e21c000001\"]","moons_json":"[\"a09acf0235\"]","port":9993,"allow_managed":true,"allow_global":false,"allow_default":false,"allow_dns":false}' >"$test_root/config/config.json"
printf '%s\n' '8056c2e21c000001' '8056c2e21c000002' >"$test_root/data/managed-network"
printf '%s\n' 'a09acf0235' 'deadbeef00' >"$test_root/data/managed-moon"
ONEKVM_EXTENSION_CONFIG="$test_root/config" \
ONEKVM_EXTENSION_DATA="$test_root/data" \
    "$test_root/bin/onekvm-zerotier-controller" --apply
test "$(cat "$test_root/data/ready-attempts")" = 3
grep -q 'leave 8056c2e21c000002' "$test_root/data/cli.log"
grep -q 'deorbit deadbeef00' "$test_root/data/cli.log"
grep -q 'orbit a09acf0235 a09acf0235' "$test_root/data/cli.log"
test "$(cat "$test_root/data/managed-network")" = '8056c2e21c000001'
test "$(cat "$test_root/data/managed-moon")" = 'a09acf0235'

# Public status includes the local node ID as well as joined network details.
cat >"$test_root/bin/zerotier-cli" <<'EOF'
#!/bin/sh
case " $* " in
    *' info '*) printf '%s\n' '{"address":"a09acf0235","online":true}' ;;
    *' listnetworks '*) printf '%s\n' '[{"nwid":"8056c2e21c000001","status":"OK","assignedAddresses":["10.10.10.1/24"]}]' ;;
    *' listmoons '*) printf '%s\n' '[{"id":"000000a09acf0235","waiting":false,"roots":[{"stableEndpoints":["203.0.113.8/9993"]}]}]' ;;
    *) exit 1 ;;
esac
EOF
chmod +x "$test_root/bin/zerotier-cli"
status_output=$(printf '%s' '{"event":"invoke","extension_id":"zerotier","enabled":true,"method":"status"}' | \
    ONEKVM_EXTENSION_CONFIG="$test_root/config" \
    ONEKVM_EXTENSION_DATA="$test_root/data" \
    "$test_root/bin/onekvm-zerotier-controller" --controller)
printf '%s' "$status_output" | grep -q '"nodeId":"a09acf0235"'
printf '%s' "$status_output" | grep -q '"assignedAddresses":'
printf '%s' "$status_output" | grep -q '10.10.10.1'
printf '%s' "$status_output" | grep -q '"id":"000000a09acf0235"'
printf '%s' "$status_output" | grep -q '"stableEndpoints":'
printf '%s' "$status_output" | grep -q '203.0.113.8'

# A failed leave remains pending instead of silently forgetting the network.
cat >"$test_root/bin/zerotier-cli" <<'EOF'
#!/bin/sh
case " $* " in
    *' leave '*) exit 1 ;;
    *) exit 0 ;;
esac
EOF
chmod +x "$test_root/bin/zerotier-cli"
printf '%s\n' '8056c2e21c000001' '8056c2e21c000002' >"$test_root/data/managed-network"
if ONEKVM_EXTENSION_CONFIG="$test_root/config" \
    ONEKVM_EXTENSION_DATA="$test_root/data" \
    "$test_root/bin/onekvm-zerotier-controller" --apply; then
    echo 'failed ZeroTier leave unexpectedly succeeded' >&2
    exit 1
fi
test "$(cat "$test_root/data/managed-network")" = "$(printf '%s\n' '8056c2e21c000001' '8056c2e21c000002')"

# Command output is retained so a failed configure reports the real local API
# error instead of only an opaque exit status.
cat >"$test_root/bin/zerotier-cli" <<'EOF'
#!/bin/sh
case " $* " in
    *' info '*) exit 0 ;;
    *' join '*) echo '503 local control API unavailable' >&2; exit 7 ;;
    *) exit 0 ;;
esac
EOF
chmod +x "$test_root/bin/zerotier-cli"
printf '%s\n' '{"networks_json":"[\"8056c2e21c000003\"]","port":9993,"allow_managed":true,"allow_global":false,"allow_default":false,"allow_dns":false}' >"$test_root/config/config.json"
: >"$test_root/data/managed-network"
if ONEKVM_EXTENSION_CONFIG="$test_root/config" \
    ONEKVM_EXTENSION_DATA="$test_root/data" \
    "$test_root/bin/onekvm-zerotier-controller" --apply \
    2>"$test_root/apply-error"; then
    echo 'failed ZeroTier join unexpectedly succeeded' >&2
    exit 1
fi
grep -q 'join ZeroTier network 8056c2e21c000003 failed (exit 7): 503 local control API unavailable' "$test_root/apply-error"

# A failed deorbit is reported and remains managed so it can be retried.
cat >"$test_root/bin/zerotier-cli" <<'EOF'
#!/bin/sh
case " $* " in
    *' info '*) exit 0 ;;
    *' deorbit '*) echo '500 Moon removal failed' >&2; exit 8 ;;
    *) exit 0 ;;
esac
EOF
chmod +x "$test_root/bin/zerotier-cli"
printf '%s\n' '{"networks_json":"[]","moons_json":"[]","port":9993,"allow_managed":true,"allow_global":false,"allow_default":false,"allow_dns":false}' >"$test_root/config/config.json"
: >"$test_root/data/managed-network"
printf '%s\n' 'a09acf0235' >"$test_root/data/managed-moon"
if ONEKVM_EXTENSION_CONFIG="$test_root/config" \
    ONEKVM_EXTENSION_DATA="$test_root/data" \
    "$test_root/bin/onekvm-zerotier-controller" --apply \
    2>"$test_root/moon-error"; then
    echo 'failed ZeroTier deorbit unexpectedly succeeded' >&2
    exit 1
fi
grep -q 'deorbit ZeroTier Moon a09acf0235 failed (exit 8): 500 Moon removal failed' "$test_root/moon-error"
test "$(cat "$test_root/data/managed-moon")" = 'a09acf0235'
