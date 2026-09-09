#include <json-c/json.h>

#include <signal.h>
#include <sys/types.h>
#include <sys/wait.h>
#include <unistd.h>

#include <algorithm>
#include <cerrno>
#include <chrono>
#include <cctype>
#include <cstdlib>
#include <cstring>
#include <filesystem>
#include <fstream>
#include <iostream>
#include <iterator>
#include <set>
#include <string>
#include <string_view>
#include <thread>
#include <vector>

namespace {

constexpr std::size_t kMaxNetworks = 32;
constexpr std::size_t kMaxMoons = 32;

struct Settings {
  std::vector<std::string> network_ids;
  std::vector<std::string> moon_ids;
  int port = 9993;
  bool allow_managed = true;
  bool allow_global = false;
  bool allow_default = false;
  bool allow_dns = false;
};

std::string EnvironmentPath(const char *name, std::string_view fallback) {
  const char *value = std::getenv(name);
  return value != nullptr && *value != '\0' ? value : std::string(fallback);
}

std::string ConfigPath() {
  return EnvironmentPath("ONEKVM_EXTENSION_CONFIG",
                         "/run/onekvm/extensions/zerotier") +
         "/config.json";
}

std::string DataPath() {
  return EnvironmentPath("ONEKVM_EXTENSION_DATA",
                         "/data/onekvm/extensions/zerotier");
}

bool ReadFile(const std::string &path, bool allow_missing, std::string &data,
              std::string &error) {
  std::ifstream input(path, std::ios::binary);
  if (!input) {
    if (allow_missing && errno == ENOENT)
      return true;
    error = "open " + path + ": " + std::strerror(errno);
    return false;
  }
  data.assign(std::istreambuf_iterator<char>(input),
              std::istreambuf_iterator<char>());
  if (data.size() > (1U << 20)) {
    error = path + " exceeds 1 MiB";
    return false;
  }
  return true;
}

json_object *ParseJSON(std::string_view input, std::string &error) {
  json_tokener *tokener = json_tokener_new_ex(32);
  if (tokener == nullptr) {
    error = "allocate JSON parser";
    return nullptr;
  }
  json_tokener_set_flags(tokener, JSON_TOKENER_STRICT);
  json_object *value = json_tokener_parse_ex(
      tokener, input.data(), static_cast<int>(input.size()));
  const auto status = json_tokener_get_error(tokener);
  std::size_t end = json_tokener_get_parse_end(tokener);
  json_tokener_free(tokener);
  while (end < input.size() &&
         std::isspace(static_cast<unsigned char>(input[end])))
    ++end;
  if (status != json_tokener_success || value == nullptr ||
      end != input.size()) {
    if (value != nullptr)
      json_object_put(value);
    error = "invalid JSON";
    return nullptr;
  }
  return value;
}

bool OptionalBool(json_object *root, const char *name, bool &output) {
  json_object *value = nullptr;
  if (!json_object_object_get_ex(root, name, &value))
    return true;
  if (!json_object_is_type(value, json_type_boolean))
    return false;
  output = json_object_get_boolean(value) != 0;
  return true;
}

bool OptionalInt(json_object *root, const char *name, int &output) {
  json_object *value = nullptr;
  if (!json_object_object_get_ex(root, name, &value))
    return true;
  if (!json_object_is_type(value, json_type_int))
    return false;
  output = json_object_get_int(value);
  return true;
}

bool IsNetworkID(std::string_view value) {
  if (value.size() != 16)
    return false;
  return std::all_of(value.begin(), value.end(), [](char character) {
    return std::isxdigit(static_cast<unsigned char>(character)) != 0;
  });
}

bool IsMoonID(std::string_view value) {
  if (value.size() != 10)
    return false;
  return std::all_of(value.begin(), value.end(), [](char character) {
    return std::isxdigit(static_cast<unsigned char>(character)) != 0;
  }) && value != "0000000000";
}

std::string NormalizeNetworkID(std::string value) {
  for (char &character : value)
    character = static_cast<char>(
        std::tolower(static_cast<unsigned char>(character)));
  return value;
}

bool ParseNetworkList(std::string_view encoded,
                      std::vector<std::string> &network_ids,
                      std::string &error) {
  json_object *array = ParseJSON(encoded, error);
  if (array == nullptr)
    return false;
  if (!json_object_is_type(array, json_type_array) ||
      json_object_array_length(array) > kMaxNetworks) {
    json_object_put(array);
    return false;
  }
  std::set<std::string> unique;
  const std::size_t count = json_object_array_length(array);
  for (std::size_t index = 0; index < count; ++index) {
    json_object *item = json_object_array_get_idx(array, index);
    if (!json_object_is_type(item, json_type_string)) {
      json_object_put(array);
      return false;
    }
    std::string id = NormalizeNetworkID(json_object_get_string(item));
    if (!IsNetworkID(id) || !unique.insert(id).second) {
      json_object_put(array);
      return false;
    }
    network_ids.push_back(std::move(id));
  }
  json_object_put(array);
  return true;
}

bool ParseMoonList(std::string_view encoded,
                   std::vector<std::string> &moon_ids,
                   std::string &error) {
  json_object *array = ParseJSON(encoded, error);
  if (array == nullptr)
    return false;
  if (!json_object_is_type(array, json_type_array) ||
      json_object_array_length(array) > kMaxMoons) {
    json_object_put(array);
    return false;
  }
  std::set<std::string> unique;
  const std::size_t count = json_object_array_length(array);
  for (std::size_t index = 0; index < count; ++index) {
    json_object *item = json_object_array_get_idx(array, index);
    if (!json_object_is_type(item, json_type_string)) {
      json_object_put(array);
      return false;
    }
    std::string id = NormalizeNetworkID(json_object_get_string(item));
    if (!IsMoonID(id) || !unique.insert(id).second) {
      json_object_put(array);
      return false;
    }
    moon_ids.push_back(std::move(id));
  }
  json_object_put(array);
  return true;
}

bool LoadSettings(bool allow_missing, Settings &settings, std::string &error) {
  std::string input;
  if (!ReadFile(ConfigPath(), allow_missing, input, error))
    return false;
  if (input.empty())
    return true;
  json_object *root = ParseJSON(input, error);
  if (root == nullptr)
    return false;
  bool valid = json_object_is_type(root, json_type_object) &&
               OptionalInt(root, "port", settings.port) &&
               OptionalBool(root, "allow_managed", settings.allow_managed) &&
               OptionalBool(root, "allow_global", settings.allow_global) &&
               OptionalBool(root, "allow_default", settings.allow_default) &&
               OptionalBool(root, "allow_dns", settings.allow_dns);
  json_object *networks_value = nullptr;
  if (valid && json_object_object_get_ex(root, "networks_json", &networks_value)) {
    valid = json_object_is_type(networks_value, json_type_string) &&
            ParseNetworkList(json_object_get_string(networks_value),
                             settings.network_ids, error);
  } else if (valid) {
    // Migrate the original single-network setting on the first save.
    json_object *legacy = nullptr;
    if (json_object_object_get_ex(root, "network_id", &legacy)) {
      valid = json_object_is_type(legacy, json_type_string);
      if (valid) {
        std::string id = NormalizeNetworkID(json_object_get_string(legacy));
        if (!id.empty()) {
          valid = IsNetworkID(id);
          if (valid)
            settings.network_ids.push_back(std::move(id));
        }
      }
    }
  }
  json_object *moons_value = nullptr;
  if (valid && json_object_object_get_ex(root, "moons_json", &moons_value)) {
    valid = json_object_is_type(moons_value, json_type_string) &&
            ParseMoonList(json_object_get_string(moons_value),
                          settings.moon_ids, error);
  }
  json_object_put(root);
  if (!valid || settings.port < 0 || settings.port > 65535) {
    error = "invalid ZeroTier settings";
    return false;
  }
  return true;
}

std::string Executable(std::string_view name) {
  std::vector<char> buffer(4096);
  const ssize_t length = readlink("/proc/self/exe", buffer.data(),
                                  buffer.size() - 1);
  if (length <= 0)
    return "bin/" + std::string(name);
  buffer[static_cast<std::size_t>(length)] = '\0';
  std::filesystem::path path(buffer.data());
  return (path.parent_path() / name).string();
}

[[noreturn]] void Exec(std::vector<std::string> arguments) {
  std::vector<char *> values;
  values.reserve(arguments.size() + 1);
  for (std::string &argument : arguments)
    values.push_back(argument.data());
  values.push_back(nullptr);
  execv(values.front(), values.data());
  std::cerr << "onekvm-zerotier-controller: exec " << arguments.front()
            << ": " << std::strerror(errno) << '\n';
  std::_Exit(127);
}

int RunCommandCapture(std::vector<std::string> arguments, std::string &output) {
  int pipe_fds[2];
  if (pipe(pipe_fds) != 0)
    return -1;
  const pid_t child = fork();
  if (child < 0) {
    close(pipe_fds[0]);
    close(pipe_fds[1]);
    return -1;
  }
  if (child == 0) {
    close(pipe_fds[0]);
    (void)dup2(pipe_fds[1], STDOUT_FILENO);
    (void)dup2(pipe_fds[1], STDERR_FILENO);
    close(pipe_fds[1]);
    Exec(std::move(arguments));
  }
  close(pipe_fds[1]);
  output.clear();
  char buffer[4096];
  while (output.size() <= (1U << 20)) {
    const ssize_t count = read(pipe_fds[0], buffer, sizeof(buffer));
    if (count > 0) {
      output.append(buffer, static_cast<std::size_t>(count));
      continue;
    }
    if (count < 0 && errno == EINTR)
      continue;
    break;
  }
  close(pipe_fds[0]);
  int status = 0;
  while (waitpid(child, &status, 0) < 0) {
    if (errno != EINTR)
      return -1;
  }
  if (output.size() > (1U << 20))
    return -1;
  return WIFEXITED(status) ? WEXITSTATUS(status) : -1;
}

std::vector<std::string> CLI(const std::string &home,
                             std::initializer_list<std::string> arguments) {
  std::vector<std::string> command{Executable("zerotier-cli"), "-D" + home};
  command.insert(command.end(), arguments.begin(), arguments.end());
  return command;
}

std::string CommandFailure(std::string context, int result,
                           std::string output) {
  for (char &character : output) {
    const unsigned char value = static_cast<unsigned char>(character);
    if (std::isspace(value))
      character = ' ';
    else if (std::iscntrl(value))
      character = '?';
  }
  while (!output.empty() && output.front() == ' ')
    output.erase(output.begin());
  while (!output.empty() && output.back() == ' ')
    output.pop_back();
  if (output.size() > 512) {
    output.resize(509);
    output += "...";
  }
  context += " failed (exit " + std::to_string(result) + ")";
  if (!output.empty())
    context += ": " + output;
  return context;
}

bool RunCLICommand(const std::string &home,
                   std::initializer_list<std::string> arguments,
                   std::string context, std::string &error) {
  std::string output;
  const int result = RunCommandCapture(CLI(home, arguments), output);
  if (result == 0)
    return true;
  error = CommandFailure(std::move(context), result, std::move(output));
  return false;
}

bool WaitForControlAPI(const std::string &home, std::string &error) {
  const std::string token = home + "/authtoken.secret";
  std::string output;
  int result = -1;
  for (int attempt = 0; attempt < 100; ++attempt) {
    if (std::filesystem::exists(token)) {
      result = RunCommandCapture(CLI(home, {"info"}), output);
      if (result == 0)
        return true;
    }
    std::this_thread::sleep_for(std::chrono::milliseconds(100));
  }
  error = CommandFailure("ZeroTier control API did not become ready", result,
                         std::move(output));
  return false;
}

void PrintJSON(json_object *response) {
  std::cout << json_object_to_json_string_ext(response, JSON_C_TO_STRING_PLAIN)
            << '\n';
  json_object_put(response);
}

void PrintStatus() {
  const std::string home = DataPath() + "/zerotier-one";
  std::string networks_output;
  const int networks_result = RunCommandCapture(
      CLI(home, {"-j", "listnetworks"}), networks_output);
  std::string parse_error;
  json_object *networks = networks_result == 0
                              ? ParseJSON(networks_output, parse_error)
                              : nullptr;
  if (networks == nullptr || !json_object_is_type(networks, json_type_array)) {
    if (networks != nullptr)
      json_object_put(networks);
    networks = json_object_new_array();
  }

  std::string moons_output;
  const int moons_result =
      RunCommandCapture(CLI(home, {"-j", "listmoons"}), moons_output);
  json_object *moons = moons_result == 0
                           ? ParseJSON(moons_output, parse_error)
                           : nullptr;
  if (moons == nullptr || !json_object_is_type(moons, json_type_array)) {
    if (moons != nullptr)
      json_object_put(moons);
    moons = json_object_new_array();
  }

  std::string info_output;
  const int info_result =
      RunCommandCapture(CLI(home, {"-j", "info"}), info_output);
  json_object *info =
      info_result == 0 ? ParseJSON(info_output, parse_error) : nullptr;
  bool online = networks_result == 0;
  std::string node_id;
  if (info != nullptr && json_object_is_type(info, json_type_object)) {
    json_object *online_value = nullptr;
    if (json_object_object_get_ex(info, "online", &online_value) &&
        json_object_is_type(online_value, json_type_boolean)) {
      online = json_object_get_boolean(online_value) != 0;
    }
    json_object *address_value = nullptr;
    if (json_object_object_get_ex(info, "address", &address_value) &&
        json_object_is_type(address_value, json_type_string)) {
      node_id = json_object_get_string(address_value);
    }
  }
  if (info != nullptr)
    json_object_put(info);

  json_object *response = json_object_new_object();
  json_object_object_add(response, "online", json_object_new_boolean(online));
  json_object_object_add(response, "nodeId",
                         json_object_new_string(node_id.c_str()));
  json_object_object_add(response, "networks", networks);
  json_object_object_add(response, "moons", moons);
  PrintJSON(response);
}

std::set<std::string> ReadManagedIDs(const std::string &path,
                                     bool (*validator)(std::string_view)) {
  std::string input;
  std::string ignored;
  (void)ReadFile(path, true, input, ignored);
  std::set<std::string> ids;
  std::string line;
  for (char character : input) {
    if (character == '\n' || character == '\r') {
      line = NormalizeNetworkID(std::move(line));
      if (validator(line))
        ids.insert(std::move(line));
      line.clear();
    } else {
      line.push_back(character);
    }
  }
  line = NormalizeNetworkID(std::move(line));
  if (validator(line))
    ids.insert(std::move(line));
  return ids;
}

bool WriteManagedIDs(const std::string &path,
                     const std::vector<std::string> &ids,
                     std::string_view description, std::string &error) {
  if (ids.empty()) {
    std::error_code remove_error;
    std::filesystem::remove(path, remove_error);
    return true;
  }
  std::ofstream output(path, std::ios::trunc);
  if (!output) {
    error = "write managed ZeroTier " + std::string(description);
    return false;
  }
  for (const std::string &id : ids)
    output << id << '\n';
  if (!output) {
    error = "write managed ZeroTier " + std::string(description);
    return false;
  }
  return true;
}

int RunDaemon(std::string &error);
int Apply(std::string &error);

int WaitPid(pid_t pid) {
  int status = 0;
  while (waitpid(pid, &status, 0) < 0) {
    if (errno != EINTR)
      return -1;
  }
  return WIFEXITED(status) ? WEXITSTATUS(status) : -1;
}

pid_t Spawn(int (*fn)(std::string &), std::string &error) {
  const pid_t pid = fork();
  if (pid < 0) {
    error = std::string("fork: ") + std::strerror(errno);
    return -1;
  }
  if (pid == 0) {
    std::string child_error;
    const int result = fn(child_error);
    if (result != 0 && !child_error.empty())
      std::cerr << "onekvm-zerotier-controller: " << child_error << '\n';
    std::_Exit(result == 0 ? 0 : 1);
  }
  return pid;
}

int Service(std::string &error) {
  const pid_t daemon = Spawn(RunDaemon, error);
  if (daemon < 0)
    return 1;
  const pid_t apply = Spawn(Apply, error);
  if (apply > 0)
    WaitPid(apply);
  int status = 0;
  while (waitpid(daemon, &status, 0) < 0) {
    if (errno != EINTR) {
      error = "wait: " + std::string(std::strerror(errno));
      return 1;
    }
  }
  error = "zerotier-one exited";
  return WIFEXITED(status) ? WEXITSTATUS(status) : 1;
}

int RunDaemon(std::string &error) {
  Settings settings;
  if (!LoadSettings(false, settings, error))
    return 1;
  const std::string home = DataPath() + "/zerotier-one";
  std::error_code filesystem_error;
  std::filesystem::create_directories(home, filesystem_error);
  if (filesystem_error) {
    error = "create ZeroTier home: " + filesystem_error.message();
    return 1;
  }
  Exec({Executable("zerotier-one"), "-U",
        "-p" + std::to_string(settings.port), home});
}

int Apply(std::string &error) {
  Settings settings;
  if (!LoadSettings(false, settings, error))
    return 1;
  const std::string data = DataPath();
  const std::string home = data + "/zerotier-one";
  // The token survives a daemon restart.  Its presence therefore does not
  // prove that the new local control endpoint is accepting requests yet.
  // Wait for an actual CLI round trip before applying joins and options.
  if (!WaitForControlAPI(home, error))
    return 1;

  const std::set<std::string> previous =
      ReadManagedIDs(data + "/managed-network", IsNetworkID);
  const std::set<std::string> desired(settings.network_ids.begin(),
                                      settings.network_ids.end());
  for (const std::string &id : previous) {
    if (desired.find(id) == desired.end() &&
        !RunCLICommand(home, {"leave", id},
                       "leave ZeroTier network " + id, error)) {
      return 1;
    }
  }

  const std::pair<const char *, bool> flags[] = {
      {"allowManaged", settings.allow_managed},
      {"allowGlobal", settings.allow_global},
      {"allowDefault", settings.allow_default},
      {"allowDNS", settings.allow_dns},
  };
  for (const std::string &id : settings.network_ids) {
    if (!RunCLICommand(home, {"join", id},
                       "join ZeroTier network " + id, error)) {
      return 1;
    }
    for (const auto &[name, option_enabled] : flags) {
      if (!RunCLICommand(home,
                         {"set", id,
                          std::string(name) + "=" +
                              (option_enabled ? "1" : "0")},
                         std::string("set ZeroTier option ") + name +
                             " for " + id,
                         error)) {
        return 1;
      }
    }
  }

  const std::set<std::string> previous_moons =
      ReadManagedIDs(data + "/managed-moon", IsMoonID);
  const std::set<std::string> desired_moons(settings.moon_ids.begin(),
                                            settings.moon_ids.end());
  for (const std::string &id : previous_moons) {
    if (desired_moons.find(id) == desired_moons.end() &&
        !RunCLICommand(home, {"deorbit", id},
                       "deorbit ZeroTier Moon " + id, error)) {
      return 1;
    }
  }
  for (const std::string &id : settings.moon_ids) {
    if (!RunCLICommand(home, {"orbit", id, id},
                       "orbit ZeroTier Moon " + id, error)) {
      return 1;
    }
  }

  if (!WriteManagedIDs(data + "/managed-network", settings.network_ids,
                       "networks", error) ||
      !WriteManagedIDs(data + "/managed-moon", settings.moon_ids, "Moons",
                       error)) {
    return 1;
  }
  return 0;
}

} // namespace

int main(int argc, char **argv) {
  std::string error;
  int result = 1;
  const std::string_view command = argc >= 2 ? argv[1] : "--service";
  if (argc > 2) {
    error = "usage: onekvm-zerotier-controller "
            "[--service|status|--health|--run|--apply]";
  } else if (command == "--service") {
    result = Service(error);
  } else if (command == "status") {
    PrintStatus();
    result = 0;
  } else if (command == "--health") {
    Settings settings;
    result = LoadSettings(true, settings, error) ? 0 : 1;
  } else if (command == "--run") {
    result = RunDaemon(error);
  } else if (command == "--apply") {
    result = Apply(error);
  } else {
    error = "usage: onekvm-zerotier-controller "
            "[--service|status|--health|--run|--apply]";
  }
  if (result != 0)
    std::cerr << "onekvm-zerotier-controller: " << error << '\n';
  return result;
}
