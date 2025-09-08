#include <iostream>
#include <fstream>
#include <vector>
#include <string>
#include <sstream>

#include <nlohmann/json.hpp>

using json = nlohmann::json;

// Node structure matching the grid
struct Node {
    int id;
    std::string state;
    std::vector<int> neighbors;
    int q,r,s;

    // optional fields for A* step
    int distance = 0;
    bool visited = false;
    int h_cost = 0;
    int f_cost = 0;
    int g_cost = std::numeric_limits<int>::max();

    int parent = -1;

    bool operator>(const Node& other) const;
    bool operator==(const Node& other) const;
};

bool Node::operator>(const Node& other) const 
{
    return f_cost > other.f_cost;
}

bool Node::operator==(const Node& other) const 
{
    return q == other.q && r == other.r && s == other.s;
}

const std::vector<std::tuple<int,int,int>> HEX_DIRECTIONS = {
    {+1, -1, 0},   // east
    {+1, 0, -1},   // northeast
    {0, +1, -1},   // northwest
    {-1, +1, 0},   // west
    {-1, 0, +1},   // southwest
    {0, -1, +1}    // southeast
};


int manhattanDistance(Node* start, Node* end)
{
    return (std::abs(end->q - start->q) +
            std::abs(end->s - start->s) +
            std::abs(end->r - start->r))/2;
}

struct CompareNodes {
    bool operator()(const Node* a, const Node* b) const {
        if (a->f_cost == b->f_cost) {
            return a->h_cost > b->h_cost;
        }
        return a->f_cost > b->f_cost;
    }
};

void buildNeighbors(std::vector<Node>& nodes) {
    for (auto& node : nodes) {
        node.neighbors.clear();
        for (auto [dq, dr, ds] : HEX_DIRECTIONS) {
            int nq = node.q + dq;
            int nr = node.r + dr;
            int ns = node.s + ds;

            // find a node that matches these cube coords
            for (auto& other : nodes) {
                if (other.q == nq && other.r == nr && other.s == ns) {
                    node.neighbors.push_back(other.id);
                    break; // stop after finding one match
                }
            }
        }
    }
}

void astar_init(std::vector<Node>& nodes, int startId, int endId)
{
    // Initialize Cost.
    if (startId <0 || startId >= nodes.size() ||  endId <0 || endId >= nodes.size()) {
        fprintf(stderr, "No start/end node??\n");
        return;
    }
    Node& endNode = nodes[endId];
 
    // Remove "blacked out elements"
    // std::erase(std::remove_if(nodes.first(), nodes.end(), [](Node& node){
    //     node.state == "BLACK";
    // }));
    buildNeighbors(nodes);
    std::fprintf(stderr, "Built neighbors\n");
}

void reconstructPath(std::unordered_map<int, Node*>& visited, Node* current, Node* start)
{      
    std::vector<Node*> path;
    int max_len = 100;
    while (!(current == start)) 
    {
        if (max_len-- <= 0) {
            fprintf(stderr, "Bug, current(%d), parent(%d)\n", current->id, current->parent);
            return;
        }
        path.push_back(current);
        auto it = visited.find(current->id);
        if (it == visited.end() || current->id == start->id) break;
        current = visited[it->second->parent];
    }
    path.push_back(current); // push start node.

    reverse(path.begin(), path.end());
    for (auto& n : path) {
        n->distance = n->f_cost;
        n->visited = true;
        std::fprintf(stderr, "(%d)->", n->id);
    }
}
void astar_solve(std::vector<Node>& nodes, int startId, int endId)
{
    std::priority_queue<Node*, std::vector<Node*>, CompareNodes> OpenList;
    std::unordered_map<int, Node*> ClosedList;

    Node* start = &nodes[startId];
    Node* goal = &nodes[endId];

    if (goal->state == "BLACK") {
        fprintf(stderr, "Cannot navigate, end goal is 'blocked'\n");
        return;
    }

    start->g_cost = 0;
    start->h_cost = manhattanDistance(goal, start);
    start->f_cost = start->g_cost +  start->h_cost;
    OpenList.push(start);

    while (!OpenList.empty()) {
        Node* current = OpenList.top();
        OpenList.pop();
        fprintf(stderr, "-->Checking Node(%d)\n", current->id);

        if (current->id == endId) {
            fprintf(stderr, "Found the end cost : %d\n", current->f_cost);
            ClosedList[current->id] = current;
            reconstructPath(ClosedList, current, start);
            return;
        }
        // ALready been here, move on
        if (ClosedList.count(current->id)) {
            // fprintf(stderr, "<--Already been to (%d)\n", current->id);
            continue;
        }
        ClosedList[current->id] = current;
        for (int n_successor : current->neighbors) {
            Node* successor = &nodes[n_successor];

            if (successor->state == "BLACK") {
                continue;
            }

            if (ClosedList.count(successor->id)) {
                // fprintf(stderr, "  <--Already been to (%d)\n", successor->id);
                continue;
            }
            successor->parent = current->id;
            successor->h_cost = manhattanDistance(goal, successor);
            successor->g_cost = current->g_cost + 1; 
            successor->f_cost = successor->g_cost + successor->h_cost;
            // std::fprintf(stderr, "  >--Pushing node(%d)\n", successor->id);
            
            OpenList.push(successor);
            if (successor->id == endId) {
                std::fprintf(stderr, "  --Found target, early breaking\n");
                break;
            }
        }
        fprintf(stderr, "<-- Done with (%d)\n", current->id);
    }
    fprintf(stderr, "Failed to find path\n");
}


// from_json helper
void from_json(const json& j, Node& n) {
    n.id = j.at("id").get<int>();
    n.state = j.at("state").get<std::string>();
    n.neighbors = j.at("neighbors").get<std::vector<int>>();

    n.distance = j.at("distance").get<int>();
    n.f_cost = j.at("cost").get<int>();

    n.q = j["q"].get<int>();
    n.r = j["r"].get<int>();
    n.s = j["s"].get<int>();
}

void to_json(json& j, const Node& n) {
    j = json{
        {"id", n.id},
        {"state", n.state},
        {"neighbors", n.neighbors},
        {"distance", n.distance},
        {"visited", n.visited},
        {"cost", n.f_cost},
        {"q", n.q},
        {"r", n.r},
        {"s", n.s},
    };
}

int main() {
    // Read entire stdin
    std::ostringstream ss;
    ss << std::cin.rdbuf();
    std::string input = ss.str();

    // std::ifstream f("test-nodes.json");

    try {
        json j = json::parse(input);
        std::vector<Node> nodes = j["gridData"]["nodes"];
        int startId = j["startId"];
        int endId = j["endId"];

        {
            astar_init(nodes, startId, endId);
            astar_solve(nodes, startId, endId);
        }
        

        // Output updated nodes as JSON
        json output = j["gridData"];
        output["nodes"] = nodes;

        std::cerr << output.dump() << std::endl;
        std::cout << output.dump() << std::endl;

    } catch (const std::exception& e) {
        std::cerr << "Error parsing JSON: " << e.what() << std::endl;
        std::cerr << "Input: " << input << std::endl;
        return 1;
    }

    return 0;
}