package com.company.RoomsNDoors;

import com.company.Base;
import com.company.You;

import java.util.Scanner;

public class Hell extends Base {
    public String object = "  Hell  ";
    public static String name = "hell";
    public static int position = -10;
    public static int sectorPosition;
    public static int doorPosition;

    public void setPosition(int sectorPosition) {
        Hell.sectorPosition = sectorPosition;
        switch (sectorPosition) {
            case 8:
                doorPosition = 31;
                position = 3;
                break;
            case 12:
                doorPosition = 32;
                position = 11;
                break;
            case 14:
                doorPosition = 33;
                position = 15;
                break;
            case 18:
                doorPosition = 34;
                position = 23;
                break;
            default:
                position = -1;
        }
    }

    public void enterHell() {
        Scanner scanner = new Scanner(System.in);
        You.won = true;
        System.out.println("congratulations,you have entered hell\n" +
                "it is a notable day in history of...NO WAIT!!!\n" +
                "press enter to continue...");
        scanner.nextLine();
        System.out.println("its KRAKEN 2.0\n" +
                "its much bigger than you would have imagined.\n" +
                "press enter to continue...");
        scanner.nextLine();
        finalPic();
        System.out.println("TO BE CONTINUED...");
        System.out.println("press enter to continue...");
        scanner.nextLine();
    }

    public void finalPic() {
        System.out.println("                                                                         _________________________     ");
        System.out.println("                                                                        /                         \\   ");
        System.out.println("                                                                       /           _____           \\  ");
        System.out.println("                                                ______________________/           /     \\           \\______________________");
        System.out.println("                                               /                     (           (       )           )                     \\");
        System.out.println("                                              /                       \\           \\_____/           /                        \\");
        System.out.println("                                             /                         \\                           /                          \\");
        System.out.println("                                            /                           \\_________________________/                            \\");
        System.out.println("                                           |                                                                                   |");
        System.out.println("                  /\\                       |       _________________________                   _________________________       |");
        System.out.println("                 /  \\                      |      /                         \\                 /                         \\      |");
        System.out.println("                /____\\                     |     /           _____           \\               /           _____           \\     |");
        System.out.println("               |      |                    |    /           /     \\           \\             /           /     \\           \\    |");
        System.out.println("               |______|                    |   (           (       )           )           (           (       )           )   |");
        System.out.println("              __\\____/__                   |    \\           \\_____/           /             \\           \\_____/           /    |");
        System.out.println("             /           \\    (_)          |     \\                           /               \\                           /     |");
        System.out.println("            / |         | \\  /  /|         |      \\_________________________/                 \\_________________________/      |");
        System.out.println("           /  |         |  \\/  /_|         |                                                                                   |");
        System.out.println("          |   \\ _______ /\\____/   \\        |                                                                                   |");
        System.out.println("          /___ |_______|     (     )       |                                                                                   |");
        System.out.println("           (_)/         \\     \\___/        |                                                                                   |");
        System.out.println("             /           \\                 |                                                                                   |");
        System.out.println("            /     /\\      \\                |                                                                                   |");
        System.out.println("           /     |  |      \\               |                                                                                   |");

    }

    @Override
    public void printMap(int sectorPosition) {
        setPosition(sectorPosition);
        Base.positionHell = position;
        setHere(object, position);
        super.printMap(position);
        switch (doorPosition) {
            case 31:
                if (Door1.doorOpen1) {
                    System.out.println("the door beside Hell shut itself and got locked");
                }
                break;
            case 32:
                if (Door2.doorOpen2) {
                    System.out.println("the door beside Hell shut itself and got locked");
                }
                break;
            case 33:
                if (Door3.doorOpen3) {
                    System.out.println("the door beside Hell shut itself and got locked");
                }
                break;
            case 34:
                if (Door4.doorOpen4) {
                    System.out.println("the door beside Hell shut itself and got locked");
                }
        }
    }
}
