
INC := -I ../libs/json/include
CFLAGS := -std=c++17 $(INC)
all:
		g++  $(CFLAGS) astar.cpp -o astar