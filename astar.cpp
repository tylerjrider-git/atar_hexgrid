#include <iostream>
#include <fstream>

#include <vector>
#include <string>
#include <sstream>
#include <nlohmann/json.hpp>

using json = nlohmann::json;

// Node structure matching the grid
struct Node {
    int mId;
    std::string state;
    std::vector<int> neighbors;
    int q,r,s;

    // optional fields for A* step
    int h_cost = 0;
    int f_cost = 0;
    int g_cost = std::numeric_limits<int>::max();

    int parent = -1;
    int distance = 0;
    bool visited = false;
    bool operator==(const Node& other) const;
};

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


static int manhattanDistance(Node* start, Node* end)
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

static void findNeighbors(std::vector<Node>& nodes, Node& node)
{
    node.neighbors.clear();
    for (auto [dq, dr, ds] : HEX_DIRECTIONS) {
        int nq = node.q + dq;
        int nr = node.r + dr;
        int ns = node.s + ds;
        
        // find a node that matches these cube coords
        for (auto& other : nodes) {
            // Skip blocked nodes.
            if (other.state == "CLOSED")
                continue;
            if (other.q == nq && other.r == nr && other.s == ns) {
                node.neighbors.push_back(other.mId);
                break;
            }
        }
    }
}

static void reconstructPath(std::unordered_map<int, Node*>& visited, Node* current, Node* start)
{      
    std::vector<Node*> path;
    while ((current != start)) 
    {
        path.push_back(current);
        auto it = visited.find(current->mId);
        if (it == visited.end() || current->mId == start->mId) break;
        current = visited[it->second->parent];
    }
    path.push_back(current); // push start node.

    reverse(path.begin(), path.end());
    for (auto& n : path) {
        n->distance = n->g_cost;
        n->visited = true;
    }
}

static bool astar_solve(std::vector<Node>& nodes, int startId, int endId)
{
    std::priority_queue<Node*, std::vector<Node*>, CompareNodes> OpenList;
    std::unordered_map<int, Node*> ClosedList;
    Node* start = &nodes[startId];
    Node* goal = &nodes[endId];

    if (goal->state == "CLOSED")
        return false;

    start->g_cost = 0;
    start->h_cost = manhattanDistance(goal, start);
    start->f_cost = start->g_cost +  start->h_cost;
    OpenList.push(start);

    while (!OpenList.empty()) {
        Node* current = OpenList.top();
        OpenList.pop();

        if (*current == *goal) {
            ClosedList[current->mId] = current;
            reconstructPath(ClosedList, current, start);
            return true;
        }

        // Already been here, move on
        if (ClosedList.count(current->mId))
            continue;

        ClosedList[current->mId] = current;

        findNeighbors(nodes, *current);
        for (int n : current->neighbors) {
            Node* successor = &nodes[n];

            // Already traversed this node
            if (ClosedList.count(successor->mId))
                continue;

                // Have already been here and its cheaper.
            if (successor->g_cost < (current->g_cost + 1))
                continue;

            successor->parent = current->mId;
            successor->h_cost = manhattanDistance(goal, successor);
            successor->g_cost = current->g_cost + 1; 
            successor->f_cost = successor->g_cost + successor->h_cost;
            OpenList.push(successor);

            // early break to skip to the next pop().
            if (successor->mId == endId)
                break;
        }
    }
    return false;
}


// from_json helper
static void from_json(const json& j, Node& n) {
    n.mId = j.at("id").get<int>();
    n.state = j.at("state").get<std::string>();
    n.neighbors = j.at("neighbors").get<std::vector<int>>();
    n.distance = j.at("distance").get<int>();
    n.f_cost = j.at("cost").get<int>();
    n.q = j["q"].get<int>();
    n.r = j["r"].get<int>();
    n.s = j["s"].get<int>();
}

static void to_json(json& j, const Node& n) {
    j = json{
        {"id", n.mId},
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

    try {
        json j = json::parse(input);
        std::vector<Node> nodes = j["gridData"]["nodes"];
        int startId = j["startId"];
        int endId = j["endId"];
        astar_solve(nodes, startId, endId);
        // Output updated nodes as JSON
        json output = j["gridData"];
        output["nodes"] = nodes;

        std::cout << output.dump() << std::endl;

    } catch (const std::exception& e) {
        std::cerr << "Error parsing JSON: " << e.what() << std::endl;
        std::cerr << "Input: " << input << std::endl;
        return 1;
    }

    return 0;
}